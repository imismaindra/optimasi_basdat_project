const db = require('../config/database');

const PostModel = {
    create: async (userId, content, imageUrl) => {
        const sql = `INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING id`;
        const result = await db.query(sql, [userId, content, imageUrl]);
        return { id: result.rows[0].id, user_id: userId, content };
    },

    // 1. Get all posts from followed users (timeline)
    getTimeline: async (userId, limit = 20, offset = 0) => {
        const sql = `
            SELECT p.*, u.username, u.profile_picture_url 
            FROM posts p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1) 
            ORDER BY p.created_at DESC 
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(sql, [userId, parseInt(limit), parseInt(offset)]);
        return result.rows;
    },

    // 2. Like a post
    likePost: async (userId, postId) => {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const insertLike = `INSERT INTO likes (post_id, user_id) VALUES ($1, $2)`;
            await client.query(insertLike, [postId, userId]);

            // Increment Denormalized Counter
            const updateCount = `UPDATE posts SET likes_count_cached = likes_count_cached + 1 WHERE id = $1`;
            await client.query(updateCount, [postId]);

            await client.query('COMMIT');
            return { message: "Liked successfully" };
        } catch (err) {
            await client.query('ROLLBACK');
            // Postgres unique constraint error code 23505
            if (err.code === '23505') {
                return { message: "Already liked" };
            }
            throw err;
        } finally {
            client.release();
        }
    },

    // 3. Add comment to a post
    addComment: async (userId, postId, text) => {
        const sql = `INSERT INTO comments (post_id, user_id, text) VALUES ($1, $2, $3) RETURNING id`;
        const result = await db.query(sql, [postId, userId, text]);
        return { id: result.rows[0].id, post_id: postId, text };
    },

    // 4. Get all comments for a post with pagination
    getComments: async (postId, limit = 20, offset = 0) => {
        const sql = `
            SELECT c.*, u.username 
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.post_id = $1 
            ORDER BY c.created_at ASC 
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(sql, [postId, parseInt(limit), parseInt(offset)]);
        return result.rows;
    }
};

module.exports = PostModel;
