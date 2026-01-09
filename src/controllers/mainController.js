const UserModel = require('../models/userModel');
const PostModel = require('../models/postModel');
const FollowModel = require('../models/followModel');

const MainController = {
    index: async (req, res) => {
        try {
            if(!req.session.userId) return res.redirect('/login');
            
            const currentUserId = req.session.userId;
            
            // Get Timeline
            const feed = await PostModel.getTimeline(currentUserId);
            // Get Current User Info
            const currentUser = await UserModel.getProfileWithStats(currentUserId);
            // Get Suggestions (exclude self)
            let allUsers = await UserModel.getAll();
            allUsers = allUsers.filter(u => u.id != currentUserId);

            res.render('index', { 
                feed, 
                user: currentUser, 
                suggestions: allUsers,
                currentUserId 
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Server Error: " + err.message);
        }
    },

    profile: async (req, res) => {
        try {
            if(!req.session.userId) return res.redirect('/login');
            const currentUserId = req.session.userId;
            
            const profileId = req.params.id;
            const profileUser = await UserModel.getProfileWithStats(profileId);
            // Fetch loggedInUser for Navbar display
            const loggedInUser = await UserModel.getProfileWithStats(currentUserId);
            
            const db = require('../config/database');
            const result = await db.query("SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC", [profileId]);
            const posts = result.rows;

            res.render('profile', { user: profileUser, loggedInUser, posts, currentUserId });
        } catch (err) {
            res.status(500).send(err.message);
        }
    },

    createPost: async (req, res) => {
        try {
            if(!req.session.userId) return res.redirect('/login');
            const { content } = req.body;
            // image handling simplified for demo
            await PostModel.create(req.session.userId, content, ''); 
            res.redirect('/');
        } catch (err) {
            res.status(500).send(err.message);
        }
    },

    followUser: async (req, res) => {
        try {
            if(!req.session.userId) return res.status(401).json({error: 'Unauthorized'});
            const { following_id } = req.body;
            await FollowModel.follow(req.session.userId, following_id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Simplified Controller Actions reusing session....
    likePost: async (req, res) => {
        try {
            if(!req.session.userId) return res.status(401).json({error: 'Unauthorized'});
            const { post_id } = req.body;
            await PostModel.likePost(req.session.userId, post_id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    addComment: async (req, res) => {
         try {
            if(!req.session.userId) return res.status(401).json({error: 'Unauthorized'});
            const { post_id, text } = req.body;
            await PostModel.addComment(req.session.userId, post_id, text);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getComments: async (req, res) => {
        try {
            const comments = await PostModel.getComments(req.params.post_id);
            res.json(comments);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = MainController;
