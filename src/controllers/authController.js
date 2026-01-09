const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');

const AuthController = {
    // Views
    loginPage: (req, res) => {
        res.render('login', { error: null });
    },
    
    registerPage: (req, res) => {
        res.render('register', { error: null });
    },

    // Actions
    register: async (req, res) => {
        try {
            const { username, password, bio } = req.body;
            if(!username || !password) {
                 return res.render('register', { error: 'Username and password required' });
            }
            await UserModel.create(username, password, bio, '');
            res.redirect('/login?success=register');
        } catch (err) {
            console.error(err);
            res.render('register', { error: 'Error: ' + err.message });
        }
    },

    login: async (req, res) => {
        try {
            const { username, password } = req.body;
            const user = await UserModel.findByUsername(username);
            
            if (!user) {
                return res.render('login', { error: 'Invalid credentials' });
            }

            // Jika user lama belum punya password (karena migrasi/seeding lama), kita bypass atau handle
            let valid = false;
            if(!user.password) {
                 // Untuk demo user lama: anggap valid jika user ada (atau paksa reset db)
                 // Sebaiknya kita re-seed db bersih.
                 valid = true; 
            } else {
                 valid = await bcrypt.compare(password, user.password);
            }

            if (!valid) {
                return res.render('login', { error: 'Invalid credentials' });
            }

            // Set Session
            req.session.userId = user.id;
            res.redirect('/?success=login');
        } catch (err) {
            console.error(err);
            res.render('login', { error: 'Server error' });
        }
    },

    logout: (req, res) => {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    }
};

module.exports = AuthController;
