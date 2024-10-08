const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Student = require('../models/Student');
const Tutor = require('../models/Tutor');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const multer = require('multer');
// Route for updating the profile for both students and tutors
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory where the profile pictures will be saved
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Create a unique filename
  }
});

const upload = multer({ storage: storage });
// Secret key for JWT
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Use environment variable for production

// Register User (Student or Tutor)
router.post('/register', async (req, res) => {
    try {
      const { username, password, email, role, ...profile } = req.body;
  
      // Check if user already exists
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
  
      // Encrypt password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create the User document
      const user = new User({
        username,
        password: hashedPassword,
        email,
        role
      });
  
      await user.save();
  
      // Create the Student or Tutor document
      if (role === 'Student') {
        const student = new Student({
          username,
          email,
          ...profile
        });
        await student.save();
  
      } else if (role === 'Tutor') {
        const tutor = new Tutor({
          ...profile,  // Other profile-specific fields for Tutor
          username,
          email,
          role
        });
        await tutor.save();
      } else {
        return res.status(400).json({ error: 'Invalid role specified' });
      }
  
      // Generate JWT
      const token = jwt.sign(
        { id: user._id, role: user.role },
        jwtSecret,
        { expiresIn: '1h' } // Token expires in 1 hour
      );
  
      res.status(201).json({ user, token });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });


  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if the user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
  
      // Check if the password is correct
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
  
      // Generate JWT
      const token = jwt.sign(
        { id: user._id, role: user.role },
        jwtSecret,
        { expiresIn: '1h' } // Token expires in 1 hour
      );
  
      // Decode role from token to determine which collection to query
      const decoded = jwt.verify(token, jwtSecret);
      let profileData;
  
      if (decoded.role === 'Student') {
        // Fetch student profile data
        const studentProfile = await Student.findOne({ email });
        profileData = studentProfile ? studentProfile.profile : {};
      } else if (decoded.role === 'Tutor') {
        // Fetch tutor profile data
        const tutorProfile = await Tutor.findOne({ email });
        profileData = tutorProfile ? tutorProfile.profile : {};
      } else {
        return res.status(400).json({ error: 'Invalid role' });
      }
  
      // Send token and user information with profile data
      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: profileData
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  


// Route for updating the profile (with optional profile picture) for both students and tutors
router.put('/update-profile', upload.single('profilePicture'), async (req, res) => {
  try {
    const { userId, profile } = req.body;

    // Find the user document by userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle the profile picture if uploaded
    let profilePictureUrl = null;
    if (req.file) {
      profilePictureUrl = req.file.path; // Save the path of the uploaded profile picture
    }

    let updatedProfile;

    if (user.role === 'Tutor') {
      // Update tutor profile, including profile picture
      updatedProfile = await Tutor.findOneAndUpdate(
        { email: user.email },  // Find tutor by the email associated with the user
        {
          $set: {
            ...profile,
            'profile_picture': profilePictureUrl || profile.profile_picture, // Update profile picture if new one is uploaded
          }
        },
        { new: true, runValidators: true }
      );
    } else if (user.role === 'Student') {
      // Update student profile, including profile picture
      updatedProfile = await Student.findOneAndUpdate(
        { email: user.email },  // Find student by the email associated with the user
        {
          $set: {
            ...profile,
            'profile_picture': profilePictureUrl || profile.profile_picture, // Update profile picture if new one is uploaded
          }
        },
        { new: true, runValidators: true }
      );
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!updatedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.status(200).json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
  

  router.get('/get-tutors', async (req, res) => {
    try {
      // Fetch all tutors from the database
      const tutors = await Tutor.find({});
  
      // If no tutors are found, return a 404 response
      if (tutors.length === 0) {
        return res.status(404).json({ message: 'No tutors found' });
      }
  
      // Return the list of tutors
      res.status(200).json({ tutors });
    } catch (err) {
      console.error('Error fetching tutors:', err.message || err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });
  

module.exports = router;


