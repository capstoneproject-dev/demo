# Capstone Project - Demo Version

This is the static demo version of the Capstone project, designed to be deployed on GitHub Pages.

## Structure

```
demo/
├── index.html          # Homepage (redirects to login)
├── pages/
│   ├── dashboard.html  # Dashboard page
│   ├── admin.html      # Admin panel
│   ├── login.html      # Login page
│   └── register.html   # Registration page
├── assets/
│   └── css/
│       ├── dashboard.css
│       └── admin.css
├── data/
│   └── users.json      # Mock database (JSON)
└── js/
    ├── dataLoader.js   # Data loading abstraction
    ├── dashboard.js    # Dashboard functionality
    └── admin.js        # Admin panel functionality
```

## Features

- ✅ Static HTML files (no PHP required)
- ✅ Mock data from JSON files
- ✅ Same design as PHP version
- ✅ Fully functional UI/UX
- ✅ Ready for GitHub Pages deployment

## How to Use

### Local Testing

1. Open `index.html` in a web browser
2. Or use a local server:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx http-server
   ```

### GitHub Pages Deployment

1. Push the `demo` folder to your GitHub repository
2. Go to repository Settings → Pages
3. Select source: `main` branch, `/demo` folder
4. Your site will be live at: `https://yourusername.github.io/repo-name/demo/`

## Integration with PHP Version

When ready to integrate with the database:

1. Copy HTML structure from `demo/pages/*.html` to `pages/*/index.php`
2. Replace JavaScript data loading with PHP database queries
3. CSS files are already in `pages/*/` folder (dashboard.css, admin.css)
4. Update paths in PHP files to match the new structure

## Mock Data

The `data/users.json` file contains:
- User statistics
- Recent users list
- All users list

You can edit this file to change the demo data.

## Notes

- Forms are functional but don't actually save data (demo mode)
- Login accepts any credentials and redirects to dashboard
- All data is loaded from JSON files via JavaScript
- CSS files are in `assets/css/` folder
- HTML pages are in `pages/` folder
- Matches the structure of the PHP version for easy integration
