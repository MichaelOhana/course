# Standalone Email Collection Page

This is a standalone email collection page that can be hosted separately from your main course and redirect users to the course after email submission.

## Setup Instructions

### 1. Configuration
Edit the `index.html` file and update these two URLs:

```javascript
FORMSPREE_ENDPOINT: 'https://formspree.io/f/meogyrry', // Your Formspree endpoint (already configured)
COURSE_URL: 'https://YOUR_USERNAME.github.io/YOUR_COURSE_REPO/', // URL to your main course
```

### 2. Update the Course URL
Replace `YOUR_USERNAME` and `YOUR_COURSE_REPO` with your actual GitHub username and course repository name.

Example:
```javascript
COURSE_URL: 'https://johndoe.github.io/language-course/',
```

### 3. Deploy to GitHub Pages
1. Create a new repository for the email collection (e.g., `language-course-signup`)
2. Upload the `index.html` file to the repository
3. Enable GitHub Pages in repository settings
4. Your email collection page will be available at: `https://YOUR_USERNAME.github.io/language-course-signup/`

### 4. How It Works
1. User visits the email collection page
2. User enters their email and clicks "Acceder al Curso"
3. Email is submitted to Formspree
4. User is automatically redirected to your main course
5. If email submission fails, it's saved locally and user is still redirected

### 5. Features
- ✅ Beautiful Spanish interface
- ✅ Email validation
- ✅ Formspree integration (same endpoint as before)
- ✅ Automatic redirect to course
- ✅ Error handling with fallback
- ✅ Loading states and success messages
- ✅ Mobile responsive
- ✅ No backend required

### 6. Customization
You can customize:
- Colors and styling (edit the Tailwind classes)
- Text content (change the Spanish text)
- Redirect delay (currently 2 seconds)
- Error messages
- Logo/icon

### 7. Testing
1. Deploy to GitHub Pages
2. Visit your email collection URL
3. Enter an email and submit
4. Check that you're redirected to the course
5. Verify email appears in your Formspree dashboard

This solution separates the email collection from the course, making the course always accessible while still collecting emails from new users. 