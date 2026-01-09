const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const db = require('./src/config/database');
const routes = require('./src/routes');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Session Middleware
app.use(session({
    secret: 'secret_key_statusshare_opt', // In production use env var
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set true if https
}));

// Routes
app.use('/', routes);

// Seed Data helper (with simple password hash for demo users if needed, or skip)
// We skip auto-seeding complex data to avoid duplicate conflicts on restart 
// or implement check if users exist.
const seedData = async () => {
    try {
        const [rows] = await db.query("SELECT count(*) as count FROM users");
        if (rows[0].count === 0) {
            console.log("Database is empty. You can register a new user.");
        }
    } catch(e) {
        // Table might not exist yet if init is slow
        console.log("Waiting for tables to initialize...");
    }
};

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    seedData();
});
