const express = require('express');
const router = express.Router();
const MainController = require('../controllers/mainController');
const AuthController = require('../controllers/authController');

// Auth Routes
router.get('/login', AuthController.loginPage);
router.post('/login', AuthController.login);
router.get('/register', AuthController.registerPage);
router.post('/register', AuthController.register);
router.get('/logout', AuthController.logout);

// Protected Pages
router.get('/', MainController.index);
router.get('/profile/:id', MainController.profile);

// Protected Actions
router.post('/post', MainController.createPost);
router.post('/follow', MainController.followUser);
router.post('/like', MainController.likePost);
router.post('/comment', MainController.addComment);
router.get('/post/:post_id/comments', MainController.getComments);

module.exports = router;
