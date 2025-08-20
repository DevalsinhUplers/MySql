# 🚀 Talent Profiles Backend API

This is the backend server for your Talent Profiles application that connects to your MySQL database.

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **MySQL** database running (XAMPP)
- **Database `talent`** already imported with the `user` table

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Database
Edit `config.env` file with your MySQL settings:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=talent
```

### 3. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Profiles
- `GET /api/profiles` - Get all profiles
- `GET /api/profiles/:id` - Get profile by ID
- `POST /api/profiles` - Create new profile
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile

### Health Check
- `GET /api/health` - Check server and database status

## 🔧 Configuration

The server automatically maps your database fields to the format expected by your React app:

- `fullTimeRate` → `rates.fullTime`
- `partTimeRate` → `rates.partTime`
- `timezone`, `startHour`, `endHour`, `startDate`, `immediatelyAvailable` → `availability.*`
- `device`, `securityMeasures` → `deviceAndSecurity.*`
- `aiTools`, `aiExperienceLevel`, `aiWorkflows` → `aiEfficiency.*`

## 🧪 Testing the API

### Test Database Connection
```bash
curl http://localhost:5000/api/health
```

### Get All Profiles
```bash
curl http://localhost:5000/api/profiles
```

### Get Profile by ID
```bash
curl http://localhost:5000/api/profiles/1
```

## 🚨 Troubleshooting

### Common Issues:

1. **"Connection refused"**
   - Make sure MySQL is running in XAMPP
   - Check if port 3306 is available

2. **"Access denied"**
   - Verify username/password in `config.env`
   - Check MySQL user permissions

3. **"Database not found"**
   - Ensure the `talent` database exists
   - Import the SQL file if needed

4. **"Port already in use"**
   - Change `PORT` in `config.env`
   - Or kill the process using port 5000

### Debug Mode:
```bash
# Enable detailed logging
DEBUG=* npm run dev
```

## 📊 Database Schema

The API expects your `user` table to have these fields:
- `id`, `name`, `title`, `imageUrl`, `yearsOfExperience`
- `summary`, `skills` (JSON), `industries` (JSON)
- `valueAddition`, `projects` (JSON), `videoUrl`
- `timezone`, `startHour`, `endHour`, `startDate`, `immediatelyAvailable`
- `fullTimeRate`, `partTimeRate`, `showRates`
- `device`, `securityMeasures` (JSON)
- `aiTools` (JSON), `aiExperienceLevel`, `aiWorkflows` (JSON)

## 🔄 Next Steps

1. **Start the backend server**
2. **Update your React app** to use the API endpoints
3. **Test the connection** between frontend and backend
4. **Enjoy real-time data** from your MySQL database!

---

**Happy coding! 🚀**
