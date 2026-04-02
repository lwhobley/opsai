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
import httpx

from database import get_db, engine, Base, AsyncSessionLocal
from models import (
    User, InventoryItem, InventoryCount, KitchenInventoryItem, 
    KitchenInventoryCount, Purchase, Sale, MenuItem, MenuItemIngredient,
    ToastIntegration,
    WasteLog
)

# ── Simple in-memory login rate limiter ──────────────────────────────────────
from contextlib import asynccontextmanager
from collections import defaultdict
import time as _time

_login_attempts: dict = defaultdict(list)   # ip -> [timestamps]
LOGIN_RATE_LIMIT  = int(os.environ.get("LOGIN_RATE_LIMIT", "10"))   # max attempts
LOGIN_RATE_WINDOW = int(os.environ.get("LOGIN_RATE_WINDOW", "300"))  # per N seconds (5 min)

def _check_rate_limit(ip: str) -> None:
    now = _time.monotonic()
    window_start = now - LOGIN_RATE_WINDOW
    _login_attempts[ip] = [t for t in _login_attempts[ip] if t > window_start]
    if len(_login_attempts[ip]) >= LOGIN_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many login attempts. Please wait 5 minutes.")
    _login_attempts[ip].append(now)

def _clear_rate_limit(ip: str) -> None:
    _login_attempts.pop(ip, None)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required and must not be empty")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == "admin"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin_pin = os.environ.get("ADMIN_PIN")
            if not admin_pin:
                raise RuntimeError("ADMIN_PIN environment variable is required to seed the admin user.")
            admin_user = User(name="Admin", pin_hash=hash_pin(admin_pin), role="admin")
            db.add(admin_user)
            await db.commit()
            logger.info("Admin user seeded from ADMIN_PIN env var.")

    yield  # app is running

    # ── Shutdown ─────────────────────────────────────────────
    await engine.dispose()

app = FastAPI(title="Ops AI - Restaurant Operations", lifespan=lifespan)
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
async def login(data: PinLogin, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    result = await db.execute(select(User).where(User.is_active == True))
    users = result.scalars().all()
    
    for user in users:
        if verify_pin(data.pin, user.pin_hash):
            _clear_rate_limit(client_ip)   # reset on success
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
                secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true",
                samesite="lax", max_age=86400, path="/"
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

class PinReset(BaseModel):
    pin: str

@api_router.put("/users/{user_id}/pin")
async def reset_user_pin(user_id: str, data: PinReset, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    if not data.pin or not data.pin.isdigit() or len(data.pin) not in (4, 6):
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 or 6 digits")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.pin_hash = hash_pin(data.pin)
    await db.commit()
    return {"message": "PIN updated successfully"}

# Bar Inventory endpoints
@api_router.post("/inventory/bar/items", response_model=InventoryItemResponse)
async def create_bar_item(data: InventoryItemCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    item = InventoryItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse(**{**item.__dict__, 'latest_count': None})

@api_router.get("/inventory/bar/items", response_model=List[InventoryItemResponse])
async def get_bar_items(location: Optional[str] = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
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
async def get_kitchen_items(location: Optional[str] = None, station: Optional[str] = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
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
    dump = data.model_dump()
    # Ensure both fields are consistent — purchase_type is the canonical field
    dump['item_type'] = dump.get('purchase_type') or dump.get('item_type')
    purchase = Purchase(**dump)
    db.add(purchase)
    await db.commit()
    return {"message": "Purchase recorded", "id": purchase.id}

@api_router.get("/purchases")
async def get_purchases(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
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
async def get_sales(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Sale).where(Sale.date >= start_date).order_by(desc(Sale.date))
    )
    sales = result.scalars().all()
    return [{"id": s.id, "date": s.date.isoformat(), "total_sales": s.total_sales,
             "bar_sales": s.bar_sales, "food_sales": s.food_sales} for s in sales]

@api_router.delete("/purchases/{purchase_id}")
async def delete_purchase(purchase_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    result = await db.execute(select(Purchase).where(Purchase.id == purchase_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    await db.delete(p)
    await db.commit()
    return {"message": "Deleted"}

@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Sale not found")
    await db.delete(s)
    await db.commit()
    return {"message": "Deleted"}

# Settings — cost targets
@api_router.get("/settings/targets")
async def get_targets(user: User = Depends(get_current_user)):
    return {
        "pour_cost_target": float(os.environ.get("TARGET_POUR_COST_PCT", "20.0")),
        "food_cost_target": float(os.environ.get("TARGET_FOOD_COST_PCT", "30.0")),
    }

# Menu Items
@api_router.post("/menu/items")
async def create_menu_item(data: MenuItemCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    item = MenuItem(**data.model_dump())
    db.add(item)
    await db.commit()
    return {"message": "Menu item created", "id": item.id}

@api_router.get("/menu/items")
async def get_menu_items(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
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
async def _compute_dashboard(days: int, db: AsyncSession) -> dict:
    """Shared dashboard logic — called by route and AI insights."""
    from sqlalchemy import text
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Sales totals
    sales_result = await db.execute(
        select(func.sum(Sale.total_sales), func.sum(Sale.bar_sales), func.sum(Sale.food_sales))
        .where(Sale.date >= start_date)
    )
    sales_data = sales_result.first()
    total_sales  = sales_data[0] or 0
    bar_sales    = sales_data[1] or 0
    food_sales   = sales_data[2] or 0

    # COGS totals — single query grouped by type
    cogs_result = await db.execute(
        select(Purchase.purchase_type, func.sum(Purchase.total_cost))
        .where(Purchase.date >= start_date)
        .group_by(Purchase.purchase_type)
    )
    cogs_by_type = {row[0]: row[1] or 0 for row in cogs_result.all()}
    total_purchases   = sum(cogs_by_type.values())
    bar_purchases     = cogs_by_type.get('bar', 0)
    kitchen_purchases = cogs_by_type.get('kitchen', 0)

    pour_cost_pct  = (bar_purchases    / bar_sales    * 100) if bar_sales    > 0 else 0
    food_cost_pct  = (kitchen_purchases / food_sales   * 100) if food_sales  > 0 else 0
    total_cogs_pct = (total_purchases   / total_sales  * 100) if total_sales > 0 else 0

    target_pour = float(os.environ.get("TARGET_POUR_COST_PCT", "20.0"))
    target_food = float(os.environ.get("TARGET_FOOD_COST_PCT", "30.0"))

    # Low stock bar items — single query using subquery for latest count per item
    bar_low_sq = (
        select(
            InventoryCount.item_id,
            func.max(InventoryCount.timestamp).label("latest_ts")
        )
        .group_by(InventoryCount.item_id)
        .subquery()
    )
    bar_low_result = await db.execute(
        select(InventoryItem.name, InventoryItem.location, InventoryCount.level_percentage)
        .join(bar_low_sq, InventoryItem.id == bar_low_sq.c.item_id)
        .join(InventoryCount, and_(
            InventoryCount.item_id == bar_low_sq.c.item_id,
            InventoryCount.timestamp == bar_low_sq.c.latest_ts
        ))
        .where(InventoryItem.is_active == True)
        .where(InventoryCount.level_percentage <= 25)
    )
    low_bar_items = [
        {"name": r[0], "location": r[1], "level": r[2]}
        for r in bar_low_result.all()
    ]

    # Low stock kitchen items — single query using subquery
    kit_low_sq = (
        select(
            KitchenInventoryCount.item_id,
            func.max(KitchenInventoryCount.timestamp).label("latest_ts")
        )
        .group_by(KitchenInventoryCount.item_id)
        .subquery()
    )
    kit_low_result = await db.execute(
        select(
            KitchenInventoryItem.name, KitchenInventoryItem.location,
            KitchenInventoryItem.par_level, KitchenInventoryCount.quantity
        )
        .join(kit_low_sq, KitchenInventoryItem.id == kit_low_sq.c.item_id)
        .join(KitchenInventoryCount, and_(
            KitchenInventoryCount.item_id == kit_low_sq.c.item_id,
            KitchenInventoryCount.timestamp == kit_low_sq.c.latest_ts
        ))
        .where(KitchenInventoryItem.is_active == True)
        .where(KitchenInventoryItem.par_level > 0)
        .where(KitchenInventoryCount.quantity < KitchenInventoryItem.par_level)
    )
    low_kitchen_items = [
        {"name": r[0], "location": r[1], "par_level": r[2], "quantity": r[3]}
        for r in kit_low_result.all()
    ]

    return {
        "period_days": days,
        "total_sales": round(total_sales, 2),
        "bar_sales":   round(bar_sales, 2),
        "food_sales":  round(food_sales, 2),
        "total_cogs":  round(total_purchases, 2),
        "bar_cogs":    round(bar_purchases, 2),
        "food_cogs":   round(kitchen_purchases, 2),
        "pour_cost_pct":   round(pour_cost_pct, 1),
        "food_cost_pct":   round(food_cost_pct, 1),
        "total_cogs_pct":  round(total_cogs_pct, 1),
        "low_bar_items":     low_bar_items[:10],
        "low_kitchen_items": low_kitchen_items[:10],
        "variance": {
            "target_pour_cost": target_pour,
            "target_food_cost": target_food,
            "pour_cost_variance": round(pour_cost_pct - target_pour, 1),
            "food_cost_variance": round(food_cost_pct - target_food, 1),
        },
    }

@api_router.get("/dashboard")
async def get_dashboard(days: int = 7, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return await _compute_dashboard(days, db)

# AI Insights
@api_router.post("/ai/insights")
async def get_ai_insights(request: AIInsightRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    dashboard_data = await _compute_dashboard(request.date_range_days, db)
    
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
        model = genai.GenerativeModel(os.environ.get('GEMINI_INSIGHTS_MODEL', 'gemini-2.0-flash'))
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


# ============================================================
# Receipt / Invoice OCR Parsing (Gemini Vision)
# ============================================================

import base64

class ReceiptParseResult(BaseModel):
    vendor: Optional[str] = None
    date: Optional[str] = None          # ISO date string YYYY-MM-DD
    items: List[dict] = []              # [{name, quantity, unit, unit_cost, total_cost, purchase_type}]
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    notes: Optional[str] = None
    raw_text: Optional[str] = None      # for debugging

@api_router.post("/import/receipt")
async def parse_receipt(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    """
    Accept a photo (JPEG/PNG/WEBP) or PDF of a receipt/invoice.
    Use Gemini Vision to extract line items, then save as Purchase records.
    Returns the parsed data for user review before confirming.
    """
    content = await file.read()
    filename = file.filename.lower() if file.filename else ""

    # Determine media type
    if filename.endswith((".jpg", ".jpeg")) or file.content_type == "image/jpeg":
        media_type = "image/jpeg"
    elif filename.endswith(".png") or file.content_type == "image/png":
        media_type = "image/png"
    elif filename.endswith(".webp") or file.content_type == "image/webp":
        media_type = "image/webp"
    elif filename.endswith(".pdf") or file.content_type == "application/pdf":
        media_type = "application/pdf"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a photo (JPEG/PNG/WEBP) or PDF.")

    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 20MB.")

    # Build Gemini prompt
    prompt = """You are a receipt and invoice parser for a restaurant.

Analyze this receipt or invoice image and extract ALL line items.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "vendor": "vendor/supplier name or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "product name",
      "quantity": 1.0,
      "unit": "bottle/case/lb/each/etc or null",
      "unit_cost": 0.00,
      "total_cost": 0.00,
      "purchase_type": "bar or kitchen or supply or other"
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "notes": "any relevant notes or null"
}

Rules:
- purchase_type: "bar" for alcohol/beverages, "kitchen" for food ingredients, "supply" for cleaning/paper goods, "other" for everything else
- If a field is unknown, use null
- quantity defaults to 1 if not shown
- total_cost = quantity * unit_cost if not explicit
- Include every line item — do not skip any
- Date format must be YYYY-MM-DD
- All costs must be numbers (no currency symbols)"""

    try:
        model = genai.GenerativeModel(os.environ.get("GEMINI_RECEIPT_MODEL", "gemini-1.5-flash"))

        # Pass image/PDF as base64 inline
        b64_data = base64.b64encode(content).decode("utf-8")
        image_part = {"inline_data": {"mime_type": media_type, "data": b64_data}}

        response = model.generate_content([prompt, image_part])
        raw = response.text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw.rsplit("```", 1)[0]
            raw = raw.strip()

        parsed = json.loads(raw)

        return {
            "success": True,
            "vendor": parsed.get("vendor"),
            "date": parsed.get("date"),
            "items": parsed.get("items", []),
            "subtotal": parsed.get("subtotal"),
            "tax": parsed.get("tax"),
            "total": parsed.get("total"),
            "notes": parsed.get("notes"),
        }

    except json.JSONDecodeError as e:
        logger.error(f"Receipt parse JSON error: {e} | raw: {raw[:200]}")
        raise HTTPException(status_code=422, detail="Could not parse receipt data. Try a clearer photo.")
    except Exception as e:
        logger.error(f"Receipt parse error: {e}")
        raise HTTPException(status_code=500, detail=f"Receipt parsing failed: {str(e)}")


@api_router.post("/import/receipt/confirm")
async def confirm_receipt_purchases(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    """
    Save confirmed receipt line items as Purchase records.
    Expects: {vendor, date, items: [{name, quantity, unit, total_cost, purchase_type}]}
    """
    items  = data.get("items", [])
    vendor = data.get("vendor", "Unknown Vendor")
    date_str = data.get("date")

    if not items:
        raise HTTPException(status_code=400, detail="No items to save")

    try:
        purchase_date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc) if date_str else datetime.now(timezone.utc)
    except Exception:
        purchase_date = datetime.now(timezone.utc)

    saved = 0
    for item in items:
        name  = item.get("name", "Unknown Item").strip()
        if not name:
            continue
        p = Purchase(
            item_name=f"{name} ({vendor})" if vendor else name,
            item_type=item.get("purchase_type", "other"),
            purchase_type=item.get("purchase_type", "other"),
            quantity=float(item.get("quantity") or 1),
            total_cost=float(item.get("total_cost") or 0),
            date=purchase_date,
        )
        db.add(p)
        saved += 1

    await db.commit()
    return {"message": f"{saved} purchase{'s' if saved != 1 else ''} recorded from receipt", "saved": saved}

# Health check
@api_router.get("/")
async def root():
    return {"message": "Ops AI API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Admin endpoint to clear all data
class ClearDataConfirm(BaseModel):
    confirm: str  # must equal "DELETE_ALL"

@api_router.delete("/admin/clear-data")
async def clear_all_data(body: ClearDataConfirm, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    """Clear all data — requires explicit confirmation body: {"confirm": "DELETE_ALL"}"""
    if body.confirm != "DELETE_ALL":
        raise HTTPException(status_code=400, detail='Send {"confirm": "DELETE_ALL"} to confirm.')
    from sqlalchemy import delete
    
    # Clear counts first (foreign keys)
    await db.execute(delete(InventoryCount))
    await db.execute(delete(KitchenInventoryCount))
    
    # Clear items
    await db.execute(delete(InventoryItem))
    await db.execute(delete(KitchenInventoryItem))
    
    # Clear purchases and sales
    await db.execute(delete(Purchase))
    await db.execute(delete(Sale))
    
    # Clear menu data
    await db.execute(delete(MenuItemIngredient))
    await db.execute(delete(MenuItem))
    
    await db.commit()
    return {"message": "All data cleared successfully"}

# Include router
app.include_router(api_router)

# CORS — restrict to explicit frontend origin(s) only
_frontend_url = os.environ.get('FRONTEND_URL', '')
_allowed_origins = [o.strip() for o in _frontend_url.split(',') if o.strip()] if _frontend_url else []
if not _allowed_origins:
    logger.warning("FRONTEND_URL is not set — CORS will block all cross-origin requests. Set FRONTEND_URL in your .env.")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)



# ============================================================
# Reports & Analytics Endpoints
# ============================================================

class WasteLogCreate(BaseModel):
    item_name: str
    item_type: str                  # bar | kitchen
    reason: str                     # waste | comp | spill | breakage | expired | other
    quantity: float = 1.0
    unit: Optional[str] = None
    estimated_cost: float = 0.0
    notes: Optional[str] = None
    date: Optional[datetime] = None  # defaults to now if not supplied

# ── Waste Log ──────────────────────────────────────────────

@api_router.post("/reports/waste")
async def log_waste(data: WasteLogCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    log_date = data.date if data.date else datetime.now(timezone.utc)
    if log_date.tzinfo is None:
        log_date = log_date.replace(tzinfo=timezone.utc)
    entry = WasteLog(
        item_name=data.item_name, item_type=data.item_type, reason=data.reason,
        quantity=data.quantity, unit=data.unit, estimated_cost=data.estimated_cost,
        notes=data.notes, logged_by=user.id, date=log_date,
    )
    db.add(entry)
    await db.commit()
    return {"message": "Waste logged", "id": entry.id}

@api_router.get("/reports/waste")
async def get_waste_logs(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(WasteLog).where(WasteLog.date >= start).order_by(desc(WasteLog.date))
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id, "item_name": l.item_name, "item_type": l.item_type,
            "reason": l.reason, "quantity": l.quantity, "unit": l.unit,
            "estimated_cost": l.estimated_cost, "notes": l.notes,
            "date": l.date.isoformat(),
        }
        for l in logs
    ]

@api_router.delete("/reports/waste/{log_id}")
async def delete_waste_log(log_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    result = await db.execute(select(WasteLog).where(WasteLog.id == log_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Log not found")
    await db.delete(entry)
    await db.commit()
    return {"message": "Deleted"}

# ── Sales Report ───────────────────────────────────────────

@api_router.get("/reports/sales")
async def report_sales(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Sale).where(Sale.date >= start).order_by(Sale.date)
    )
    sales = result.scalars().all()
    rows = [{"date": s.date.strftime("%Y-%m-%d"), "total": s.total_sales, "bar": s.bar_sales, "food": s.food_sales} for s in sales]
    total  = sum(r["total"] for r in rows)
    bar    = sum(r["bar"]   for r in rows)
    food   = sum(r["food"]  for r in rows)
    avg    = round(total / len(rows), 2) if rows else 0
    return {
        "period_days": days, "rows": rows,
        "summary": {"total_sales": round(total,2), "bar_sales": round(bar,2), "food_sales": round(food,2), "avg_daily_sales": avg, "days_with_data": len(rows)},
    }

# ── Liquor / Pour Cost Report ──────────────────────────────

@api_router.get("/reports/pour-cost")
async def report_pour_cost(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start = datetime.now(timezone.utc) - timedelta(days=days)

    # Bar purchases
    purch_result = await db.execute(
        select(Purchase).where(and_(Purchase.date >= start, Purchase.purchase_type == "bar")).order_by(Purchase.date)
    )
    purchases = purch_result.scalars().all()

    # Bar sales
    sales_result = await db.execute(
        select(func.sum(Sale.bar_sales)).where(Sale.date >= start)
    )
    bar_sales = sales_result.scalar() or 0

    # Waste cost (bar)
    waste_result = await db.execute(
        select(func.sum(WasteLog.estimated_cost)).where(and_(WasteLog.date >= start, WasteLog.item_type == "bar"))
    )
    waste_cost = waste_result.scalar() or 0

    total_cogs   = sum(p.total_cost for p in purchases)
    pour_cost_pct = round((total_cogs / bar_sales * 100) if bar_sales > 0 else 0, 1)
    target        = float(os.environ.get("TARGET_POUR_COST_PCT", "20.0"))
    variance      = round(pour_cost_pct - target, 1)

    # By category
    cat_result = await db.execute(
        select(Purchase.item_name, func.sum(Purchase.total_cost))
        .where(and_(Purchase.date >= start, Purchase.purchase_type == "bar"))
        .group_by(Purchase.item_name)
        .order_by(desc(func.sum(Purchase.total_cost)))
    )
    by_item = [{"name": r[0], "cost": round(r[1], 2)} for r in cat_result.all()]

    return {
        "period_days": days,
        "bar_sales": round(bar_sales, 2),
        "bar_cogs": round(total_cogs, 2),
        "waste_cost": round(waste_cost, 2),
        "pour_cost_pct": pour_cost_pct,
        "target_pct": target,
        "variance": variance,
        "status": "over" if variance > 0 else "on_target" if variance == 0 else "under",
        "top_purchases": by_item[:10],
    }

# ── Food Cost Report ───────────────────────────────────────

@api_router.get("/reports/food-cost")
async def report_food_cost(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start = datetime.now(timezone.utc) - timedelta(days=days)

    purch_result = await db.execute(
        select(Purchase).where(and_(Purchase.date >= start, Purchase.purchase_type == "kitchen"))
    )
    purchases = purch_result.scalars().all()

    sales_result = await db.execute(select(func.sum(Sale.food_sales)).where(Sale.date >= start))
    food_sales = sales_result.scalar() or 0

    waste_result = await db.execute(
        select(func.sum(WasteLog.estimated_cost)).where(and_(WasteLog.date >= start, WasteLog.item_type == "kitchen"))
    )
    waste_cost = waste_result.scalar() or 0

    total_cogs    = sum(p.total_cost for p in purchases)
    food_cost_pct = round((total_cogs / food_sales * 100) if food_sales > 0 else 0, 1)
    target        = float(os.environ.get("TARGET_FOOD_COST_PCT", "30.0"))
    variance      = round(food_cost_pct - target, 1)

    menu_result = await db.execute(
        select(MenuItem).where(MenuItem.is_active == True).options(selectinload(MenuItem.ingredients))
    )
    menu_items = menu_result.scalars().all()
    menu_rows = []
    for item in menu_items:
        cost = sum(i.quantity_used * i.cost_per_unit for i in item.ingredients)
        pct  = round((cost / item.price * 100) if item.price > 0 else 0, 1)
        menu_rows.append({"name": item.name, "category": item.category, "price": item.price, "cost": round(cost,2), "cost_pct": pct, "margin": round(item.price - cost, 2)})
    menu_rows.sort(key=lambda x: x["cost_pct"], reverse=True)

    return {
        "period_days": days,
        "food_sales": round(food_sales, 2),
        "food_cogs": round(total_cogs, 2),
        "waste_cost": round(waste_cost, 2),
        "food_cost_pct": food_cost_pct,
        "target_pct": target,
        "variance": variance,
        "status": "over" if variance > 0 else "on_target" if variance == 0 else "under",
        "menu_items": menu_rows,
    }

# ── Inventory Variance Report ──────────────────────────────

@api_router.get("/reports/inventory-variance")
async def report_inventory_variance(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Compare the two most recent counts per bar item to show movement/shrinkage."""
    items_result = await db.execute(select(InventoryItem).where(InventoryItem.is_active == True))
    items = items_result.scalars().all()

    rows = []
    for item in items:
        counts_result = await db.execute(
            select(InventoryCount.level_percentage, InventoryCount.timestamp)
            .where(InventoryCount.item_id == item.id)
            .order_by(desc(InventoryCount.timestamp))
            .limit(2)
        )
        counts = counts_result.all()
        if len(counts) < 2:
            continue
        latest, previous = counts[0], counts[1]
        change  = latest[0] - previous[0]
        # Estimate bottle value lost
        cost_impact = round(abs(change) / 100 * (item.cost_per_unit or 0), 2)
        rows.append({
            "name": item.name, "location": item.location, "category": item.category,
            "previous_pct": previous[0], "current_pct": latest[0],
            "change_pct": change,
            "previous_date": previous[1].strftime("%Y-%m-%d %H:%M"),
            "current_date":  latest[1].strftime("%Y-%m-%d %H:%M"),
            "cost_impact": cost_impact,
            "flag": "shrinkage" if change < -25 else ("low" if latest[0] <= 25 else "ok"),
        })

    rows.sort(key=lambda x: x["change_pct"])
    total_shrinkage_cost = round(sum(r["cost_impact"] for r in rows if r["change_pct"] < -25), 2)
    low_stock = [r for r in rows if r["flag"] in ("shrinkage", "low")]

    return {
        "items": rows,
        "summary": {
            "total_items": len(rows),
            "low_stock_count": len(low_stock),
            "shrinkage_items": len([r for r in rows if r["flag"] == "shrinkage"]),
            "estimated_shrinkage_cost": total_shrinkage_cost,
        }
    }

# ── Low Stock Report ───────────────────────────────────────

@api_router.get("/reports/low-stock")
async def report_low_stock(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """All bar + kitchen items at or below par / 25% threshold."""
    bar_result = await db.execute(select(InventoryItem).where(InventoryItem.is_active == True))
    bar_items  = bar_result.scalars().all()

    low_bar = []
    for item in bar_items:
        cr = await db.execute(
            select(InventoryCount.level_percentage, InventoryCount.timestamp)
            .where(InventoryCount.item_id == item.id)
            .order_by(desc(InventoryCount.timestamp)).limit(1)
        )
        row = cr.first()
        if row and row[0] <= 25:
            low_bar.append({
                "name": item.name, "type": "bar", "location": item.location,
                "category": item.category, "level_pct": row[0],
                "last_counted": row[1].strftime("%Y-%m-%d %H:%M"),
                "cost_per_unit": item.cost_per_unit,
                "urgency": "critical" if row[0] == 0 else ("high" if row[0] <= 10 else "medium"),
            })

    kitchen_result = await db.execute(select(KitchenInventoryItem).where(KitchenInventoryItem.is_active == True))
    kitchen_items  = kitchen_result.scalars().all()

    low_kitchen = []
    for item in kitchen_items:
        cr = await db.execute(
            select(KitchenInventoryCount.quantity, KitchenInventoryCount.timestamp)
            .where(KitchenInventoryCount.item_id == item.id)
            .order_by(desc(KitchenInventoryCount.timestamp)).limit(1)
        )
        row = cr.first()
        if row and item.par_level > 0 and row[0] < item.par_level:
            pct_of_par = round(row[0] / item.par_level * 100)
            low_kitchen.append({
                "name": item.name, "type": "kitchen", "location": item.location,
                "station": item.station, "quantity": row[0], "par_level": item.par_level,
                "unit": item.unit, "pct_of_par": pct_of_par,
                "last_counted": row[1].strftime("%Y-%m-%d %H:%M"),
                "cost_per_unit": item.cost_per_unit,
                "urgency": "critical" if row[0] == 0 else ("high" if pct_of_par <= 25 else "medium"),
            })

    all_low = sorted(low_bar + low_kitchen, key=lambda x: {"critical": 0, "high": 1, "medium": 2}[x["urgency"]])
    return {
        "items": all_low,
        "summary": {
            "total_low": len(all_low),
            "critical": len([i for i in all_low if i["urgency"] == "critical"]),
            "high": len([i for i in all_low if i["urgency"] == "high"]),
            "medium": len([i for i in all_low if i["urgency"] == "medium"]),
        }
    }

# ── Waste Summary Report ───────────────────────────────────

@api_router.get("/reports/waste-summary")
async def report_waste_summary(days: int = 30, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(WasteLog.reason, WasteLog.item_type, func.count(WasteLog.id), func.sum(WasteLog.estimated_cost))
        .where(WasteLog.date >= start)
        .group_by(WasteLog.reason, WasteLog.item_type)
    )
    rows = result.all()

    by_reason = {}
    for reason, itype, count, cost in rows:
        if reason not in by_reason:
            by_reason[reason] = {"reason": reason, "count": 0, "cost": 0.0, "bar": 0.0, "kitchen": 0.0}
        by_reason[reason]["count"] += count
        by_reason[reason]["cost"]  += cost or 0
        by_reason[reason][itype]   = round((by_reason[reason].get(itype, 0) or 0) + (cost or 0), 2)

    detail_result = await db.execute(
        select(WasteLog).where(WasteLog.date >= start).order_by(desc(WasteLog.date)).limit(50)
    )
    recent = detail_result.scalars().all()

    total_cost = sum(r.estimated_cost or 0 for r in recent)
    return {
        "period_days": days,
        "total_waste_cost": round(total_cost, 2),
        "by_reason": sorted(by_reason.values(), key=lambda x: x["cost"], reverse=True),
        "recent_entries": [
            {"date": r.date.strftime("%Y-%m-%d"), "item": r.item_name, "reason": r.reason,
             "quantity": r.quantity, "unit": r.unit, "cost": r.estimated_cost, "notes": r.notes}
            for r in recent
        ],
    }

# ============================================================
# Toast POS Integration
# ============================================================

# Toast uses the same base URL for both auth and API in production
# Override individually for sandbox testing
TOAST_AUTH_BASE = os.environ.get("TOAST_AUTH_URL", os.environ.get("TOAST_API_BASE_URL", "https://ws-api.toasttab.com"))
TOAST_API_BASE  = os.environ.get("TOAST_API_URL",  os.environ.get("TOAST_API_BASE_URL", "https://ws-api.toasttab.com"))
# For sandbox: set TOAST_API_BASE_URL=https://ws-sandbox-api.eng.toasttab.com
# Or set TOAST_AUTH_URL and TOAST_API_URL individually

# Pydantic schemas
class ToastConnectRequest(BaseModel):
    client_id: str
    client_secret: str
    restaurant_guid: str
    restaurant_name: Optional[str] = None

class ToastStatusResponse(BaseModel):
    is_connected: bool
    restaurant_name: Optional[str]
    restaurant_guid: Optional[str]
    last_synced_at: Optional[str]
    last_sync_status: Optional[str]
    last_sync_message: Optional[str]
    connected_at: Optional[str]

async def _get_toast_record(db: AsyncSession) -> Optional[ToastIntegration]:
    """Return the single ToastIntegration row (singleton per deployment)."""
    result = await db.execute(select(ToastIntegration).limit(1))
    return result.scalar_one_or_none()

async def _refresh_toast_token(record: ToastIntegration, db: AsyncSession) -> bool:
    """Exchange client credentials for a new access token using Toast OAuth."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{TOAST_AUTH_BASE}/authentication/v1/authentication/login",
                json={
                    "clientId": record.client_id,
                    "clientSecret": record.client_secret,
                    "userAccessType": "TOAST_MACHINE_CLIENT",
                },
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code != 200:
            logger.error(f"Toast token refresh failed: {resp.status_code} {resp.text}")
            return False
        data = resp.json()
        token = data.get("token", {})
        record.access_token  = token.get("accessToken")
        record.refresh_token = token.get("refreshToken")
        expires_in = token.get("expiresIn", 3600)
        record.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        record.is_connected = True
        await db.commit()
        return True
    except Exception as e:
        logger.error(f"Toast token refresh exception: {e}")
        return False

async def _ensure_valid_token(record: ToastIntegration, db: AsyncSession) -> bool:
    """Ensure the access token is valid, refreshing if needed."""
    if not record.client_id or not record.client_secret:
        return False
    if not record.access_token:
        return await _refresh_toast_token(record, db)
    if record.token_expires_at:
        # Refresh 5 min before expiry
        if datetime.now(timezone.utc) >= record.token_expires_at - timedelta(minutes=5):
            return await _refresh_toast_token(record, db)
    return True

# ── Endpoints ──────────────────────────────────────────────

@api_router.post("/integrations/toast/connect")
async def toast_connect(
    data: ToastConnectRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Save Toast credentials and verify they work by fetching a token."""
    record = await _get_toast_record(db)
    if not record:
        record = ToastIntegration()
        db.add(record)

    record.client_id       = data.client_id
    record.client_secret   = data.client_secret
    record.restaurant_guid = data.restaurant_guid
    record.restaurant_name = data.restaurant_name or data.restaurant_guid
    record.is_connected    = False
    await db.flush()

    ok = await _refresh_toast_token(record, db)
    if not ok:
        raise HTTPException(status_code=400, detail="Could not authenticate with Toast. Check your Client ID, Client Secret, and Restaurant GUID.")

    record.connected_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info(f"Toast connected for restaurant: {record.restaurant_name}")
    return {"message": "Toast connected successfully", "restaurant": record.restaurant_name}


@api_router.get("/integrations/toast/status", response_model=ToastStatusResponse)
async def toast_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return current connection status."""
    record = await _get_toast_record(db)
    if not record:
        return ToastStatusResponse(
            is_connected=False, restaurant_name=None, restaurant_guid=None,
            last_synced_at=None, last_sync_status=None, last_sync_message=None, connected_at=None,
        )
    return ToastStatusResponse(
        is_connected=record.is_connected,
        restaurant_name=record.restaurant_name,
        restaurant_guid=record.restaurant_guid,
        last_synced_at=record.last_synced_at.isoformat() if record.last_synced_at else None,
        last_sync_status=record.last_sync_status,
        last_sync_message=record.last_sync_message,
        connected_at=record.connected_at.isoformat() if record.connected_at else None,
    )


@api_router.post("/integrations/toast/disconnect")
async def toast_disconnect(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Clear stored tokens and mark as disconnected."""
    record = await _get_toast_record(db)
    if record:
        record.access_token    = None
        record.refresh_token   = None
        record.is_connected    = False
        record.last_sync_status = None
        await db.commit()
    return {"message": "Toast disconnected"}


@api_router.post("/integrations/toast/sync")
async def toast_sync(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    """Pull yesterday's sales from Toast and upsert into the sales table."""
    record = await _get_toast_record(db)
    if not record or not record.is_connected:
        raise HTTPException(status_code=400, detail="Toast is not connected")

    ok = await _ensure_valid_token(record, db)
    if not ok:
        record.last_sync_status  = "error"
        record.last_sync_message = "Token refresh failed — check credentials"
        await db.commit()
        raise HTTPException(status_code=401, detail="Toast authentication failed. Reconnect in Integrations.")

    # Pull orders for yesterday (local midnight → midnight)
    today     = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{TOAST_API_BASE}/orders/v2/ordersBulk",
                headers={
                    "Authorization": f"Bearer {record.access_token}",
                    "Toast-Restaurant-External-ID": record.restaurant_guid,
                },
                params={
                    "startDate": yesterday.strftime("%Y-%m-%dT%H:%M:%S.000+0000"),
                    "endDate":   today.strftime("%Y-%m-%dT%H:%M:%S.000+0000"),
                    "pageSize":  500,
                },
            )

        if resp.status_code == 401:
            record.last_sync_status  = "error"
            record.last_sync_message = "Unauthorized — token may have expired"
            await db.commit()
            raise HTTPException(status_code=401, detail="Toast returned 401 — try reconnecting")

        if resp.status_code != 200:
            msg = f"Toast API error {resp.status_code}"
            record.last_sync_status  = "error"
            record.last_sync_message = msg
            await db.commit()
            raise HTTPException(status_code=502, detail=msg)

        orders = resp.json()  # list of order objects

        # Aggregate totals
        total_sales = 0.0
        bar_sales   = 0.0
        food_sales  = 0.0

        # Toast revenue centers: map by name contains "bar" → bar, else food
        for order in orders:
            checks = order.get("checks", [])
            for check in checks:
                amount = check.get("totalAmount", 0.0) or 0.0
                total_sales += amount
                # Revenue center heuristic — refine once you know your GUID
                rc_name = (order.get("revenueCenter") or {}).get("name", "").lower()
                if "bar" in rc_name or "beverage" in rc_name or "drink" in rc_name:
                    bar_sales += amount
                else:
                    food_sales += amount

        # Upsert into sales table for yesterday
        existing = await db.execute(
            select(Sale).where(
                Sale.date >= yesterday,
                Sale.date < today,
            )
        )
        existing_sale = existing.scalar_one_or_none()

        if existing_sale:
            existing_sale.total_sales = round(total_sales, 2)
            existing_sale.bar_sales   = round(bar_sales, 2)
            existing_sale.food_sales  = round(food_sales, 2)
        else:
            new_sale = Sale(
                date=yesterday,
                total_sales=round(total_sales, 2),
                bar_sales=round(bar_sales, 2),
                food_sales=round(food_sales, 2),
            )
            db.add(new_sale)

        record.last_synced_at    = datetime.now(timezone.utc)
        record.last_sync_status  = "success"
        record.last_sync_message = f"Synced {len(orders)} orders | ${total_sales:,.2f} total sales"
        await db.commit()

        return {
            "message": "Sync complete",
            "orders_processed": len(orders),
            "total_sales": round(total_sales, 2),
            "bar_sales":   round(bar_sales, 2),
            "food_sales":  round(food_sales, 2),
            "date": yesterday.strftime("%Y-%m-%d"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toast sync error: {e}")
        record.last_sync_status  = "error"
        record.last_sync_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


