const db = require('../config/database');

const FollowModel = {
    // 5. Follow user
    follow: async (followerId, followingId) => {
        // Postgres: INSERT INTO ... ON CONFLICT DO NOTHING
        const sql = `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING`;
        await db.query(sql, [followerId, followingId]);
        return { follower_id: followerId, following_id: followingId };
    },

    // 6. Unfollow user
    unfollow: async (followerId, followingId) => {
        const sql = `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`;
        await db.query(sql, [followerId, followingId]);
        return { message: "Unfollowed" };
    }
};

module.exports = FollowModel;
