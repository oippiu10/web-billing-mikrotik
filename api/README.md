# WEB API DOCUMENTATION

## 📁 Struktur Folder

```
web/
├── api/                    # Backend APIs khusus web panel
│   ├── config.php         # Database configuration
│   ├── dashboard_stats.php # Dashboard statistics
│   └── auth/              # Authentication APIs
│       ├── login.php      # User login
│       ├── logout.php     # User logout
│       └── check_session.php # Session validation
│
├── assets/                # Frontend assets
│   ├── css/
│   ├── js/
│   └── images/
│
├── login.html            # Login page
└── dashboard.html        # Dashboard page

api/                      # Backend APIs khusus mobile app
├── config.php           # Database configuration (shared)
├── get_all_users.php    # Mobile API
├── save_user.php        # Mobile API
└── ... (other mobile APIs)
```

---

## 🎯 Pemisahan API

### Web Panel APIs (`web/api/`)

**Purpose:** APIs yang hanya digunakan oleh web admin panel

**Files:**

- `auth/login.php` - Admin authentication
- `auth/logout.php` - Admin logout
- `auth/check_session.php` - Session validation
- `dashboard_stats.php` - Dashboard statistics
- `config.php` - Database config (copy dari api/config.php)

**Characteristics:**

- Session-based authentication
- Admin-specific features
- Web-only functionality

---

### Mobile App APIs (`api/`)

**Purpose:** APIs yang digunakan oleh mobile app Flutter

**Files:**

- `get_all_users.php` - Get PPPoE users
- `save_user.php` - Add/edit user
- `delete_user.php` - Delete user
- `payment_operations.php` - Payment CRUD
- `sync_ppp_to_db.php` - Sync Mikrotik data
- ... (50+ files)

**Characteristics:**

- Token/API key authentication
- Mobile-specific features
- Mikrotik integration

---

## 🔗 API Endpoints

### Web Panel Endpoints

#### 1. Login

```
POST /web/api/auth/login.php

Request:
{
    "username": "admin",
    "password": "admin123",
    "remember": true
}

Response:
{
    "success": true,
    "message": "Login berhasil",
    "data": {
        "username": "admin",
        "full_name": "Administrator",
        "role": "admin",
        "session_id": "..."
    }
}
```

#### 2. Logout

```
POST /web/api/auth/logout.php

Response:
{
    "success": true,
    "message": "Logout berhasil"
}
```

#### 3. Dashboard Stats

```
GET /web/api/dashboard_stats.php

Response:
{
    "success": true,
    "data": {
        "total_users": 1234,
        "online_users": 856,
        "revenue": 45000000,
        "pending_payments": 23,
        "traffic_data": [...],
        "status_distribution": {...},
        "recent_activities": [...]
    }
}
```

---

## 🔐 Authentication

### Web Panel

- **Method:** Session-based
- **Storage:** PHP $\_SESSION
- **Timeout:** 30 minutes
- **Remember Me:** Cookie token (30 days)

### Mobile App

- **Method:** API Key / Token
- **Storage:** Shared Preferences
- **Timeout:** Configurable
- **Refresh:** Auto-refresh token

---

## 📊 Database Tables

### Web Panel Specific

#### admin_users

```sql
CREATE TABLE admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(255),
    email VARCHAR(100),
    full_name VARCHAR(100),
    role ENUM('admin', 'operator'),
    is_active TINYINT(1),
    created_at TIMESTAMP,
    last_login TIMESTAMP
);
```

#### admin_sessions

```sql
CREATE TABLE admin_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    token VARCHAR(64) UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP
);
```

#### admin_activity_logs

```sql
CREATE TABLE admin_activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100),
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP
);
```

### Shared Tables (Mobile & Web)

- `users` - PPPoE users
- `payments` - Payment records
- `odp` - ODP locations
- `system_logs` - System logs

---

## 🚀 Usage Examples

### Web Panel (JavaScript)

```javascript
// Login
const response = await fetch("api/auth/login.php", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "admin",
    password: "admin123",
    remember: true,
  }),
});

// Get Dashboard Stats
const stats = await fetch("api/dashboard_stats.php");
const data = await stats.json();
console.log(data.data.total_users);

// Logout
await fetch("api/auth/logout.php", { method: "POST" });
```

### Mobile App (Dart)

```dart
// Get Users
final response = await http.get(
  Uri.parse('$baseUrl/api/get_all_users.php'),
  headers: {'Authorization': 'Bearer $token'}
);

// Save User
await http.post(
  Uri.parse('$baseUrl/api/save_user.php'),
  body: jsonEncode(userData)
);
```

---

## 🔧 Configuration

### Web API Config (`web/api/config.php`)

```php
<?php
// Same as api/config.php
$host = '127.0.0.1';
$db   = 'pppoe_monitor';
$user = 'root';
$pass = 'yahahahusein112';

$conn = new mysqli($host, $user, $pass, $db);
?>
```

### Path References

```javascript
// From web/login.html or web/dashboard.html
"api/auth/login.php"; // ✅ Correct
"api/dashboard_stats.php"; // ✅ Correct

// NOT:
"../api/auth/login.php"; // ❌ Wrong (old path)
"/api/auth/login.php"; // ❌ Wrong (absolute)
```

---

## 📝 Notes

1. **Separation of Concerns:**
   - Web APIs in `web/api/` - Admin panel only
   - Mobile APIs in `api/` - Mobile app only
   - Shared database and config

2. **Security:**
   - Web: Session-based auth
   - Mobile: Token-based auth
   - Different authentication mechanisms

3. **Maintenance:**
   - Update web APIs independently
   - Mobile APIs remain unchanged
   - Clear separation of responsibilities

---

**Last Updated:** 2026-02-01  
**Version:** 1.0.0
