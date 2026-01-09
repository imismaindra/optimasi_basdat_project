const db = require('../config/database');
const bcrypt = require('bcryptjs');

const UserModel = {
    create: async (username, password, bio, pic) => {
        // Default pic if placeholder
        if(!pic || pic.length === 0) {
                pic = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, bio, profile_picture_url) VALUES ($1, $2, $3, $4) RETURNING id`;
        const result = await db.query(sql, [username, hashedPassword, bio, pic]);
        return { id: result.rows[0].id, username, bio, pic };
    },

    findByUsername: async (username) => {
        const sql = `SELECT * FROM users WHERE username = $1`;
        const result = await db.query(sql, [username]);
        return result.rows[0];
    },

    getProfileWithStats: async (userId) => {
        const sql = `
            SELECT u.id, u.username, u.bio, u.profile_picture_url, 
                (SELECT COUNT(*)::int FROM posts WHERE user_id = u.id) as total_posts,
                (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) as followers,
                (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) as following
            FROM users u 
            WHERE u.id = $1
        `;
        const result = await db.query(sql, [userId]);
        return result.rows[0];
    },

    getAll: async () => {
        const result = await db.query("SELECT id, username, profile_picture_url FROM users LIMIT 50");
        return result.rows;
    }
};

module.exports = UserModel;
