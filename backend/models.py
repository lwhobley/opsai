import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    pin_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="staff")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    inventory_counts = relationship('InventoryCount', back_populates='user')
    kitchen_counts = relationship('KitchenInventoryCount', back_populates='user')

class InventoryItem(Base):
    __tablename__ = 'inventory_items'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    subcategory = Column(String(100))
    location = Column(String(100))
    section = Column(String(100))
    bottle_size_ml = Column(Integer)
    cost_per_unit = Column(Float, default=0.0)
    display_order = Column(Integer, default=0)
    count_priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    counts = relationship('InventoryCount', back_populates='item')

class InventoryCount(Base):
    __tablename__ = 'inventory_counts'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    item_id = Column(String(36), ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False, index=True)
    level_percentage = Column(Integer, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), index=True)
    
    item = relationship('InventoryItem', back_populates='counts')
    user = relationship('User', back_populates='inventory_counts')

class KitchenInventoryItem(Base):
    __tablename__ = 'kitchen_inventory_items'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    unit = Column(String(50))
    location = Column(String(100))
    station = Column(String(100))
    cost_per_unit = Column(Float, default=0.0)
    vendor = Column(String(255))
    display_order = Column(Integer, default=0)
    par_level = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    counts = relationship('KitchenInventoryCount', back_populates='item')

class KitchenInventoryCount(Base):
    __tablename__ = 'kitchen_inventory_counts'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    item_id = Column(String(36), ForeignKey('kitchen_inventory_items.id', ondelete='CASCADE'), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), index=True)
    
    item = relationship('KitchenInventoryItem', back_populates='counts')
    user = relationship('User', back_populates='kitchen_counts')

class Purchase(Base):
    __tablename__ = 'purchases'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(50))
    quantity = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    date = Column(DateTime(timezone=True), default=utc_now, index=True)
    purchase_type = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=utc_now)

class Sale(Base):
    __tablename__ = 'sales'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_sales = Column(Float, nullable=False)
    bar_sales = Column(Float, default=0.0)
    food_sales = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

class MenuItem(Base):
    __tablename__ = 'menu_items'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    ingredients = relationship('MenuItemIngredient', back_populates='menu_item')

class MenuItemIngredient(Base):
    __tablename__ = 'menu_item_ingredients'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    menu_item_id = Column(String(36), ForeignKey('menu_items.id', ondelete='CASCADE'), nullable=False, index=True)
    ingredient_name = Column(String(255), nullable=False)
    quantity_used = Column(Float, nullable=False)
    unit = Column(String(50))
    cost_per_unit = Column(Float, default=0.0)
    
    menu_item = relationship('MenuItem', back_populates='ingredients')

class ToastIntegration(Base):
    """Stores Toast POS OAuth credentials and sync state for the restaurant."""
    __tablename__ = 'toast_integrations'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    # Toast OAuth credentials (set via env or admin UI)
    client_id = Column(String(255), nullable=True)
    client_secret = Column(String(255), nullable=True)  # encrypted at rest via env — never logged
    # OAuth tokens
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    # Toast restaurant identity
    restaurant_guid = Column(String(255), nullable=True)
    restaurant_name = Column(String(255), nullable=True)
    # Sync state
    is_connected = Column(Boolean, default=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String(50), nullable=True)   # success | error | pending
    last_sync_message = Column(Text, nullable=True)
    # Audit
    connected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

class WasteLog(Base):
    """Tracks waste, comps, spillage, breakage for accurate cost accounting."""
    __tablename__ = 'waste_logs'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(50), nullable=False)   # bar | kitchen
    reason = Column(String(100), nullable=False)      # waste | comp | spill | breakage | expired | other
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(50), nullable=True)
    estimated_cost = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    logged_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    date = Column(DateTime(timezone=True), default=utc_now, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
