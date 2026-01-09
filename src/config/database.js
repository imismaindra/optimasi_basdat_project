require('dotenv').config();
const { Pool, Client } = require('pg');

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'statusshare_db',
};

const pool = new Pool(dbConfig);

async function initializeDatabase() {
    try {
        // 1. Check/Create Database
        // We connect to 'postgres' database to perform administrative tasks
        const sysClient = new Client({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            database: 'postgres'
        });

        try {
            await sysClient.connect();
            const checkDb = await sysClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbConfig.database]);
            if (checkDb.rowCount === 0) {
                console.log(`Database ${dbConfig.database} does not exist. Creating...`);
                await sysClient.query(`CREATE DATABASE "${dbConfig.database}"`);
                console.log(`Database ${dbConfig.database} created successfully.`);
            }
        } catch (e) {
            console.warn("Warning: Could not check/create database via 'postgres' DB. Assuming target DB exists. Error:", e.message);
        } finally {
            await sysClient.end();
        }

        // 2. Initialize Tables in the actual database
        // Users Table
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255), 
            bio TEXT,
            profile_picture_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Posts Table
        await pool.query(`CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            content TEXT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            likes_count_cached INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Follows Table
        await pool.query(`CREATE TABLE IF NOT EXISTS follows (
            follower_id INTEGER NOT NULL,
            following_id INTEGER NOT NULL,
            PRIMARY KEY (follower_id, following_id),
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Likes Table
        await pool.query(`CREATE TABLE IF NOT EXISTS likes (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Comments Table
        await pool.query(`CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)`);

        console.log('Connected to the PostgreSQL database and initialized tables.');

    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
