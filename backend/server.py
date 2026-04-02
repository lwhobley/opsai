from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
import os
import logging
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import pandas as pd
import pdfplumber
from io import BytesIO
import google.generativeai as genai

from database import get_db, engine, Base
from models import (
    User, InventoryItem, InventoryCount, KitchenInventoryItem, 
    KitchenInventoryCount, Purchase, Sale, MenuItem, MenuItemIngredient
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'ops_ai_secret')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

app = FastAPI(title="Ops AI - Restaurant Operations")
api_router = APIRouter(prefix="/api")

# Pydantic Models
class PinLogin(BaseModel):
    pin: str

class UserCreate(BaseModel):
    name: str
    pin: str
    role: str = "staff"

class UserResponse(BaseModel):
    id: str
    name: str
    role: str
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class InventoryItemCreate(BaseModel):
    name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    location: Optional[str] = None
    section: Optional[str] = None
    bottle_size_ml: Optional[int] = None
    cost_per_unit: float = 0.0
    display_order: int = 0
    count_priority: int = 0

class InventoryItemResponse(BaseModel):
    id: str
    name: str
    category: Optional[str]
    subcategory: Optional[str]
    location: Optional[str]
    section: Optional[str]
    bottle_size_ml: Optional[int]
    cost_per_unit: float
    display_order: int
    count_priority: int
    is_active: bool
    latest_count: Optional[int] = None

class InventoryCountCreate(BaseModel):
    item_id: str
    level_percentage: int

class KitchenItemCreate(BaseModel):
    name: str
    unit: Optional[str] = None
    location: Optional[str] = None
    station: Optional[str] = None
    cost_per_unit: float = 0.0
    vendor: Optional[str] = None
    display_order: int = 0
    par_level: float = 0.0

class KitchenItemResponse(BaseModel):
    id: str
    name: str
    unit: Optional[str]
    location: Optional[str]
    station: Optional[str]
    cost_per_unit: float
    vendor: Optional[str]
    display_order: int
    par_level: float
    is_active: bool
    latest_count: Optional[float] = None

class KitchenCountCreate(BaseModel):
    item_id: str
    quantity: float

class PurchaseCreate(BaseModel):
    item_name: str
    item_type: Optional[str] = None
    quantity: float
    total_cost: float
    date: Optional[datetime] = None
    purchase_type: Optional[str] = None

class SaleCreate(BaseModel):
    date: datetime
    total_sales: float
    bar_sales: float = 0.0
    food_sales: float = 0.0

class MenuItemCreate(BaseModel):
    name: str
    category: Optional[str] = None
    price: float

class MenuIngredientCreate(BaseModel):
    menu_item_id: str
    ingredient_name: str
    quantity_used: float
    unit: Optional[str] = None
    cost_per_unit: float = 0.0

class AIInsightRequest(BaseModel):
    include_bar: bool = True
    include_kitchen: bool = True
    date_range_days: int = 7

# Auth helpers
def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        result = await db.execute(select(User).where(User.id == payload["sub"]))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_manager(user: User = Depends(get_current_user)) -> User:
    if user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    return user

# Auth endpoints
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: PinLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.is_active == True))
    users = result.scalars().all()
    
    for user in users:
        if verify_pin(data.pin, user.pin_hash):
            token = create_access_token(user.id, user.role)
            response = JSONResponse(content={
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "role": user.role,
                    "is_active": user.is_active
                }
            })
            response.set_cookie(
                key="access_token", value=token, httponly=True, 
                secure=False, samesite="lax", max_age=86400, path="/"
            )
            return response
    
    raise HTTPException(status_code=401, detail="Invalid PIN")

@api_router.post("/auth/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("access_token")
    return response

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(id=user.id, name=user.name, role=user.role, is_active=user.is_active)

# User management
@api_router.post("/users", response_model=UserResponse)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    user = User(name=data.name, pin_hash=hash_pin(data.pin), role=data.role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse(id=user.id, name=user.name, role=user.role, is_active=user.is_active)

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.is_active == True))
    users = result.scalars().all()
    return [UserResponse(id=u.id, name=u.name, role=u.role, is_active=u.is_active) for u in users]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    return {"message": "User deactivated"}

# Bar Inventory endpoints
@api_router.post("/inventory/bar/items", response_model=InventoryItemResponse)
async def create_bar_item(data: InventoryItemCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    item = InventoryItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse(**{**item.__dict__, 'latest_count': None})

@api_router.get("/inventory/bar/items", response_model=List[InventoryItemResponse])
async def get_bar_items(location: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(InventoryItem).where(InventoryItem.is_active == True)
    if location:
        query = query.where(InventoryItem.location == location)
    query = query.order_by(InventoryItem.location, InventoryItem.section, InventoryItem.display_order)
    result = await db.execute(query)
    items = result.scalars().all()
    
    response = []
    for item in items:
        count_result = await db.execute(
            select(InventoryCount.level_percentage)
            .where(InventoryCount.item_id == item.id)
            .order_by(desc(InventoryCount.timestamp))
            .limit(1)
        )
        latest = count_result.scalar_one_or_none()
        response.append(InventoryItemResponse(
            id=item.id, name=item.name, category=item.category, subcategory=item.subcategory,
            location=item.location, section=item.section, bottle_size_ml=item.bottle_size_ml,
            cost_per_unit=item.cost_per_unit, display_order=item.display_order,
            count_priority=item.count_priority, is_active=item.is_active, latest_count=latest
        ))
    return response

@api_router.post("/inventory/bar/counts")
async def record_bar_count(data: InventoryCountCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    count = InventoryCount(item_id=data.item_id, level_percentage=data.level_percentage, user_id=user.id)
    db.add(count)
    await db.commit()
    return {"message": "Count recorded", "id": count.id}

@api_router.post("/inventory/bar/counts/bulk")
async def record_bar_counts_bulk(counts: List[InventoryCountCreate], db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    for data in counts:
        count = InventoryCount(item_id=data.item_id, level_percentage=data.level_percentage, user_id=user.id)
        db.add(count)
    await db.commit()
    return {"message": f"{len(counts)} counts recorded"}

@api_router.delete("/inventory/bar/items/{item_id}")
async def delete_bar_item(item_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    await db.commit()
    return {"message": "Item deactivated"}

# Kitchen Inventory endpoints
@api_router.post("/inventory/kitchen/items", response_model=KitchenItemResponse)
async def create_kitchen_item(data: KitchenItemCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    item = KitchenInventoryItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return KitchenItemResponse(**{**item.__dict__, 'latest_count': None})

@api_router.get("/inventory/kitchen/items", response_model=List[KitchenItemResponse])
async def get_kitchen_items(location: Optional[str] = None, station: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(KitchenInventoryItem).where(KitchenInventoryItem.is_active == True)
    if location:
        query = query.where(KitchenInventoryItem.location == location)
    if station:
        query = query.where(KitchenInventoryItem.station == station)
    query = query.order_by(KitchenInventoryItem.location, KitchenInventoryItem.station, KitchenInventoryItem.display_order)
    result = await db.execute(query)
    items = result.scalars().all()
    
    response = []
    for item in items:
        count_result = await db.execute(
            select(KitchenInventoryCount.quantity)
            .where(KitchenInventoryCount.item_id == item.id)
            .order_by(desc(KitchenInventoryCount.timestamp))
            .limit(1)
        )
        latest = count_result.scalar_one_or_none()
        response.append(KitchenItemResponse(
            id=item.id, name=item.name, unit=item.unit, location=item.location,
            station=item.station, cost_per_unit=item.cost_per_unit, vendor=item.vendor,
            display_order=item.display_order, par_level=item.par_level, is_active=item.is_active,
            latest_count=latest
        ))
    return response

@api_router.post("/inventory/kitchen/counts")
async def record_kitchen_count(data: KitchenCountCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    count = KitchenInventoryCount(item_id=data.item_id, quantity=data.quantity, user_id=user.id)
    db.add(count)
    await db.commit()
    return {"message": "Count recorded", "id": count.id}

@api_router.post("/inventory/kitchen/counts/bulk")
async def record_kitchen_counts_bulk(counts: List[KitchenCountCreate], db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    for data in counts:
        count = KitchenInventoryCount(item_id=data.item_id, quantity=data.quantity, user_id=user.id)
        db.add(count)
    await db.commit()
    return {"message": f"{len(counts)} counts recorded"}

@api_router.delete("/inventory/kitchen/items/{item_id}")
async def delete_kitchen_item(item_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    result = await db.execute(select(KitchenInventoryItem).where(KitchenInventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    await db.commit()
    return {"message": "Item deactivated"}

# Purchases
@api_router.post("/purchases")
async def create_purchase(data: PurchaseCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    purchase = Purchase(**data.model_dump())
    db.add(purchase)
    await db.commit()
    return {"message": "Purchase recorded", "id": purchase.id}

@api_router.get("/purchases")
async def get_purchases(days: int = 30, db: AsyncSession = Depends(get_db)):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Purchase).where(Purchase.date >= start_date).order_by(desc(Purchase.date))
    )
    purchases = result.scalars().all()
    return [{"id": p.id, "item_name": p.item_name, "item_type": p.item_type, 
             "quantity": p.quantity, "total_cost": p.total_cost, "date": p.date.isoformat(),
             "purchase_type": p.purchase_type} for p in purchases]

# Sales
@api_router.post("/sales")
async def create_sale(data: SaleCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    sale = Sale(**data.model_dump())
    db.add(sale)
    await db.commit()
    return {"message": "Sale recorded", "id": sale.id}

@api_router.get("/sales")
async def get_sales(days: int = 30, db: AsyncSession = Depends(get_db)):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Sale).where(Sale.date >= start_date).order_by(desc(Sale.date))
    )
    sales = result.scalars().all()
    return [{"id": s.id, "date": s.date.isoformat(), "total_sales": s.total_sales,
             "bar_sales": s.bar_sales, "food_sales": s.food_sales} for s in sales]

# Menu Items
@api_router.post("/menu/items")
async def create_menu_item(data: MenuItemCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    item = MenuItem(**data.model_dump())
    db.add(item)
    await db.commit()
    return {"message": "Menu item created", "id": item.id}

@api_router.get("/menu/items")
async def get_menu_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MenuItem).where(MenuItem.is_active == True).options(selectinload(MenuItem.ingredients))
    )
    items = result.scalars().all()
    response = []
    for item in items:
        total_cost = sum(i.quantity_used * i.cost_per_unit for i in item.ingredients)
        food_cost_pct = (total_cost / item.price * 100) if item.price > 0 else 0
        response.append({
            "id": item.id, "name": item.name, "category": item.category,
            "price": item.price, "total_cost": round(total_cost, 2),
            "food_cost_pct": round(food_cost_pct, 1),
            "profit_margin": round(item.price - total_cost, 2),
            "ingredients": [{"name": i.ingredient_name, "quantity": i.quantity_used, 
                           "unit": i.unit, "cost": i.cost_per_unit} for i in item.ingredients]
        })
    return response

@api_router.post("/menu/ingredients")
async def add_menu_ingredient(data: MenuIngredientCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    ingredient = MenuItemIngredient(**data.model_dump())
    db.add(ingredient)
    await db.commit()
    return {"message": "Ingredient added", "id": ingredient.id}

# Dashboard / Analytics
@api_router.get("/dashboard")
async def get_dashboard(days: int = 7, db: AsyncSession = Depends(get_db)):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get sales data
    sales_result = await db.execute(
        select(func.sum(Sale.total_sales), func.sum(Sale.bar_sales), func.sum(Sale.food_sales))
        .where(Sale.date >= start_date)
    )
    sales_data = sales_result.first()
    total_sales = sales_data[0] or 0
    bar_sales = sales_data[1] or 0
    food_sales = sales_data[2] or 0
    
    # Get purchases (COGS)
    purchases_result = await db.execute(
        select(func.sum(Purchase.total_cost))
        .where(Purchase.date >= start_date)
    )
    total_purchases = purchases_result.scalar() or 0
    
    # Bar purchases
    bar_purchases_result = await db.execute(
        select(func.sum(Purchase.total_cost))
        .where(and_(Purchase.date >= start_date, Purchase.purchase_type == 'bar'))
    )
    bar_purchases = bar_purchases_result.scalar() or 0
    
    # Kitchen purchases  
    kitchen_purchases_result = await db.execute(
        select(func.sum(Purchase.total_cost))
        .where(and_(Purchase.date >= start_date, Purchase.purchase_type == 'kitchen'))
    )
    kitchen_purchases = kitchen_purchases_result.scalar() or 0
    
    # Calculate costs
    pour_cost_pct = (bar_purchases / bar_sales * 100) if bar_sales > 0 else 0
    food_cost_pct = (kitchen_purchases / food_sales * 100) if food_sales > 0 else 0
    total_cogs_pct = (total_purchases / total_sales * 100) if total_sales > 0 else 0
    
    # Get low stock items (bar items at 25% or less)
    low_bar_items = []
    bar_items_result = await db.execute(select(InventoryItem).where(InventoryItem.is_active == True))
    for item in bar_items_result.scalars().all():
        count_result = await db.execute(
            select(InventoryCount.level_percentage)
            .where(InventoryCount.item_id == item.id)
            .order_by(desc(InventoryCount.timestamp))
            .limit(1)
        )
        level = count_result.scalar_one_or_none()
        if level is not None and level <= 25:
            low_bar_items.append({"name": item.name, "level": level, "location": item.location})
    
    # Get low stock kitchen items
    low_kitchen_items = []
    kitchen_items_result = await db.execute(select(KitchenInventoryItem).where(KitchenInventoryItem.is_active == True))
    for item in kitchen_items_result.scalars().all():
        count_result = await db.execute(
            select(KitchenInventoryCount.quantity)
            .where(KitchenInventoryCount.item_id == item.id)
            .order_by(desc(KitchenInventoryCount.timestamp))
            .limit(1)
        )
        qty = count_result.scalar_one_or_none()
        if qty is not None and item.par_level > 0 and qty < item.par_level:
            low_kitchen_items.append({"name": item.name, "quantity": qty, "par_level": item.par_level, "location": item.location})
    
    return {
        "period_days": days,
        "total_sales": round(total_sales, 2),
        "bar_sales": round(bar_sales, 2),
        "food_sales": round(food_sales, 2),
        "total_cogs": round(total_purchases, 2),
        "bar_cogs": round(bar_purchases, 2),
        "food_cogs": round(kitchen_purchases, 2),
        "pour_cost_pct": round(pour_cost_pct, 1),
        "food_cost_pct": round(food_cost_pct, 1),
        "total_cogs_pct": round(total_cogs_pct, 1),
        "low_bar_items": low_bar_items[:10],
        "low_kitchen_items": low_kitchen_items[:10],
        "variance": {
            "target_pour_cost": 20.0,
            "target_food_cost": 30.0,
            "pour_cost_variance": round(pour_cost_pct - 20.0, 1),
            "food_cost_variance": round(food_cost_pct - 30.0, 1)
        }
    }

# AI Insights
@api_router.post("/ai/insights")
async def get_ai_insights(request: AIInsightRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    dashboard_data = await get_dashboard(request.date_range_days, db)
    
    # Get menu costing data
    menu_result = await db.execute(
        select(MenuItem).where(MenuItem.is_active == True).options(selectinload(MenuItem.ingredients))
    )
    menu_items = menu_result.scalars().all()
    low_margin_items = []
    for item in menu_items:
        total_cost = sum(i.quantity_used * i.cost_per_unit for i in item.ingredients)
        margin_pct = ((item.price - total_cost) / item.price * 100) if item.price > 0 else 0
        if margin_pct < 60:
            low_margin_items.append({"name": item.name, "margin_pct": round(margin_pct, 1), "cost": round(total_cost, 2), "price": item.price})
    
    # Build context for AI
    context = {
        "period": f"Last {request.date_range_days} days",
        "sales": {
            "total": dashboard_data["total_sales"],
            "bar": dashboard_data["bar_sales"],
            "food": dashboard_data["food_sales"]
        },
        "costs": {
            "pour_cost_pct": dashboard_data["pour_cost_pct"],
            "food_cost_pct": dashboard_data["food_cost_pct"],
            "total_cogs_pct": dashboard_data["total_cogs_pct"]
        },
        "variance": dashboard_data["variance"],
        "low_stock_bar": dashboard_data["low_bar_items"],
        "low_stock_kitchen": dashboard_data["low_kitchen_items"],
        "low_margin_menu_items": low_margin_items[:5]
    }
    
    prompt = f"""You are an experienced restaurant General Manager analyzing operational data.
    
Analyze this data and provide actionable insights:
{json.dumps(context, indent=2)}

Target benchmarks:
- Pour cost should be under 20%
- Food cost should be under 30%
- Total COGS should be under 35%

Respond in this exact JSON format:
{{
    "key_issues": ["issue 1", "issue 2", "issue 3"],
    "likely_causes": ["cause 1", "cause 2", "cause 3"],
    "recommendations": [
        {{"title": "Action 1", "description": "Specific steps to take", "priority": "high"}},
        {{"title": "Action 2", "description": "Specific steps to take", "priority": "medium"}},
        {{"title": "Action 3", "description": "Specific steps to take", "priority": "low"}}
    ],
    "summary": "One sentence executive summary"
}}

Be direct, operational, and profit-focused. Write like an experienced GM."""

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean up response
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        insights = json.loads(response_text.strip())
        return {"insights": insights, "context": context}
    except Exception as e:
        logger.error(f"AI insights error: {e}")
        return {
            "insights": {
                "key_issues": ["Unable to generate AI insights at this time"],
                "likely_causes": ["Service temporarily unavailable"],
                "recommendations": [{"title": "Try Again", "description": "Please refresh and try again", "priority": "medium"}],
                "summary": "AI analysis temporarily unavailable"
            },
            "context": context
        }

# File Upload / Import
@api_router.post("/import/inventory")
async def import_inventory(file: UploadFile = File(...), inventory_type: str = "bar", db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(BytesIO(content))
        elif filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        elif filename.endswith('.pdf'):
            with pdfplumber.open(BytesIO(content)) as pdf:
                tables = []
                for page in pdf.pages:
                    page_tables = page.extract_tables()
                    if page_tables:
                        tables.extend(page_tables)
                if not tables:
                    raise HTTPException(status_code=400, detail="No tables found in PDF")
                df = pd.DataFrame(tables[0][1:], columns=tables[0][0])
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use Excel, CSV, or PDF")
        
        # Normalize column names
        df.columns = df.columns.str.lower().str.strip()
        
        imported_count = 0
        
        if inventory_type == "bar":
            for _, row in df.iterrows():
                item = InventoryItem(
                    name=str(row.get('name', row.get('item', 'Unknown'))).strip(),
                    category=str(row.get('category', '')).strip() or None,
                    subcategory=str(row.get('subcategory', '')).strip() or None,
                    location=str(row.get('location', '')).strip() or None,
                    section=str(row.get('section', '')).strip() or None,
                    bottle_size_ml=int(row.get('bottle_size_ml', row.get('size_ml', 0))) if pd.notna(row.get('bottle_size_ml', row.get('size_ml'))) else None,
                    cost_per_unit=float(row.get('cost_per_unit', row.get('cost', 0))) if pd.notna(row.get('cost_per_unit', row.get('cost'))) else 0.0
                )
                db.add(item)
                imported_count += 1
        else:
            for _, row in df.iterrows():
                item = KitchenInventoryItem(
                    name=str(row.get('name', row.get('item', 'Unknown'))).strip(),
                    unit=str(row.get('unit', '')).strip() or None,
                    location=str(row.get('location', '')).strip() or None,
                    station=str(row.get('station', '')).strip() or None,
                    cost_per_unit=float(row.get('cost_per_unit', row.get('cost', 0))) if pd.notna(row.get('cost_per_unit', row.get('cost'))) else 0.0,
                    vendor=str(row.get('vendor', '')).strip() or None,
                    par_level=float(row.get('par_level', row.get('par', 0))) if pd.notna(row.get('par_level', row.get('par'))) else 0.0
                )
                db.add(item)
                imported_count += 1
        
        await db.commit()
        return {"message": f"Successfully imported {imported_count} items", "count": imported_count}
        
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

# Health check
@api_router.get("/")
async def root():
    return {"message": "Ops AI API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed admin user
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == "admin"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin_pin = os.environ.get('ADMIN_PIN', '1234')
            admin_user = User(name="Admin", pin_hash=hash_pin(admin_pin), role="admin")
            db.add(admin_user)
            await db.commit()
            logger.info("Admin user created with PIN: " + admin_pin)
        
    # Write test credentials
    import pathlib
    pathlib.Path('/app/memory').mkdir(parents=True, exist_ok=True)
    admin_pin_val = os.environ.get('ADMIN_PIN', '1234')
    with open('/app/memory/test_credentials.md', 'w') as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin User\n")
        f.write(f"- PIN: {admin_pin_val}\n")
        f.write("- Role: admin\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/login - Login with PIN\n")
        f.write("- GET /api/auth/me - Get current user\n")
        f.write("- POST /api/auth/logout - Logout\n")

from database import AsyncSessionLocal

@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()
