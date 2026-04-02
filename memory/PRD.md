# Ops AI - Product Requirements Document

## Overview
**Product Name:** Ops AI  
**Type:** Mobile-first Progressive Web App (PWA)  
**Purpose:** Internal restaurant operations management for bar and kitchen inventory tracking, cost calculations, and AI-powered insights  
**Brand:** Enish Nigerian Restaurant aesthetic (gold/bronze on dark charcoal)

## Original Problem Statement
Build a mobile-first PWA for internal restaurant operations that tracks bar and kitchen inventory, calculates pour cost and food cost, and provides AI-powered insights to reduce waste, control COGS, and improve profitability.

## Tech Stack
- **Frontend:** React (PWA-enabled)
- **Backend:** FastAPI + Supabase (PostgreSQL)
- **AI:** Google Gemini API
- **Authentication:** 4-digit PIN with JWT tokens
- **Offline Support:** localforage for offline inventory counts

## User Personas & Roles
1. **Admin** - Full access: user management, data import, all operations
2. **Manager** - Inventory management, cost tracking, AI insights
3. **Staff** - Basic inventory counting only

## Core Requirements (Static)
1. ✅ 4-digit PIN authentication with role-based access
2. ✅ Dashboard with KPI metrics (Sales, Pour Cost %, Food Cost %, COGS %)
3. ✅ Bar Inventory Mode (location-based: Main Bar, Service Bar, Back Bar, Storage)
4. ✅ Kitchen Inventory Mode (station-based: Line, Prep Area, Walk-In, Dry Storage, Freezer)
5. ✅ Tap-based bottle level input (Full, 75%, 50%, 25%, Empty)
6. ✅ Guided count mode for systematic inventory
7. ✅ AI Insights via Gemini API
8. ✅ Menu costing with ingredient cost calculations
9. ✅ Excel/PDF import for inventory data
10. ✅ Offline counting capability
11. ✅ User management (Admin only)

## What's Been Implemented (MVP - April 2, 2026)

### Backend (FastAPI + Supabase)
- [x] Supabase PostgreSQL connection with Transaction Pooler
- [x] User authentication with bcrypt-hashed PINs and JWT tokens
- [x] Bar inventory CRUD endpoints
- [x] Kitchen inventory CRUD endpoints
- [x] Bulk count recording for both bar and kitchen
- [x] Purchases and Sales tracking
- [x] Dashboard analytics with cost calculations
- [x] Menu items with ingredient costing
- [x] AI insights endpoint using Gemini API
- [x] File upload/parsing for Excel, CSV, and PDF

### Frontend (React PWA)
- [x] Mobile-first responsive design with Enish aesthetic
- [x] 4-digit PIN login with visual feedback
- [x] Dashboard with KPI cards and charts
- [x] Bar Inventory with location selection and section tabs
- [x] Kitchen Inventory with station selection
- [x] Guided count mode for systematic counting
- [x] AI Insights page with Gemini integration
- [x] Menu Costing page
- [x] Data Import page for file uploads
- [x] User Management (Admin only)
- [x] Bottom navigation with "More" menu
- [x] Offline storage support with localforage

### Database Schema (Supabase PostgreSQL)
- users (id, name, pin_hash, role, is_active)
- inventory_items (bar: name, category, location, section, bottle_size_ml, cost_per_unit)
- inventory_counts (item_id, level_percentage, timestamp, user_id)
- kitchen_inventory_items (name, unit, location, station, cost_per_unit, vendor, par_level)
- kitchen_inventory_counts (item_id, quantity, timestamp, user_id)
- purchases (item_name, quantity, total_cost, date, purchase_type)
- sales (date, total_sales, bar_sales, food_sales)
- menu_items (name, category, price)
- menu_item_ingredients (menu_item_id, ingredient_name, quantity_used, unit, cost_per_unit)

## Prioritized Backlog

### P0 - Critical (Already Done)
- ✅ Authentication system
- ✅ Bar and Kitchen inventory counting
- ✅ Dashboard with cost metrics
- ✅ AI insights integration

### P1 - High Priority
- [ ] Real-time sync when coming back online
- [ ] Push notifications for low stock alerts
- [ ] Variance reports and trends
- [ ] Multiple count sessions per day

### P2 - Medium Priority  
- [ ] Inventory history and trend charts
- [ ] Purchase order suggestions
- [ ] Recipe management
- [ ] Vendor management
- [ ] Print/export reports

### P3 - Nice to Have
- [ ] Barcode/QR scanning for items
- [ ] Voice input for counts
- [ ] Integration with POS systems
- [ ] Multi-location support

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | - | Login with PIN |
| GET | /api/auth/me | User | Get current user |
| POST | /api/auth/logout | User | Logout |
| GET | /api/dashboard | User | Get KPI dashboard |
| GET | /api/inventory/bar/items | User | List bar items |
| POST | /api/inventory/bar/items | Manager | Create bar item |
| POST | /api/inventory/bar/counts | User | Record bar count |
| POST | /api/inventory/bar/counts/bulk | User | Bulk record counts |
| GET | /api/inventory/kitchen/items | User | List kitchen items |
| POST | /api/inventory/kitchen/items | Manager | Create kitchen item |
| POST | /api/inventory/kitchen/counts | User | Record kitchen count |
| POST | /api/ai/insights | User | Get AI insights |
| GET | /api/menu/items | User | List menu items |
| POST | /api/menu/items | Manager | Create menu item |
| POST | /api/import/inventory | Manager | Import from file |
| GET | /api/users | Admin | List users |
| POST | /api/users | Admin | Create user |

## Testing Credentials
- **Admin PIN:** 1234
- **Role:** admin
- **Access:** Full system access

## Next Tasks
1. Add real-time offline sync indicator
2. Implement low stock push notifications
3. Add variance trend charts
4. Create purchase suggestion feature
5. Add report export functionality
