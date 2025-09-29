# 🏠 Household Manager

A comprehensive household management application for roommates to coordinate chores, laundry, bills, events, and more.

## ✨ Features

- **📅 Calendar & Chores** - Weekly calendar with chore assignments and random assignment
- **👕 Laundry Scheduler** - Book washer and dryer time slots
- **💰 Bills Tracker** - Split bills and track payments
- **📦 Inventory Management** - Track household items and low stock alerts
- **🔧 Maintenance** - Report and track household issues
- **📅 Events & Polls** - Plan events and create polls for household decisions
- **👥 Roommates** - Manage roommate profiles and preferences
- **💬 Chat** - Household group chat with search functionality
- **🔔 Notifications** - Stay updated on household activities
- **⚙️ Settings** - Customize your profile and preferences

## 🚀 Getting Started

### Prerequisites
- Python 3.x (for local development server)
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/household-manager.git
   cd household-manager
   ```

2. **Start the local server**
   ```bash
   python -m http.server 8000
   ```

3. **Open in browser**
   Navigate to `http://localhost:8000`

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Storage**: LocalStorage for data persistence
- **Icons**: Font Awesome
- **Styling**: Custom CSS with modern design principles

## 📱 Features Overview

### Calendar & Chores
- Weekly calendar view with chore assignments
- Random fair assignment system
- Chore frequency management (daily, weekly, monthly)
- Color-coded assignments by roommate

### Laundry Management
- Time slot booking system (8 AM - 9 PM)
- Separate washer and dryer booking
- Real-time availability status
- Booking history and management

### Bills & Payments
- Bill splitting (equal, percentage, custom amounts)
- Payment tracking and settlement
- Monthly/yearly filtering
- Search functionality

### Inventory Tracking
- Item categorization (cleaning, groceries, bathroom, etc.)
- Low stock and out-of-stock alerts
- Purchase tracking by roommate
- Cost management

### Events & Polls
- Event creation and management
- Multiple poll types (multiple choice, yes/no, rating, ranking, date/time selection)
- Voting system with real-time updates

### Roommate Management
- Profile management with photos
- Color-coded system for easy identification
- Statistics tracking
- Preference management

### Communication
- Real-time household chat
- Message search functionality
- Notification system
- Activity tracking

## 🎨 Design Features

- **Responsive Design** - Works on desktop, tablet, and mobile
- **Modern UI** - Clean, intuitive interface
- **Color Coding** - Each roommate has a unique color
- **Dark/Light Themes** - Adaptive styling
- **Accessibility** - Keyboard navigation and screen reader support

## 🔧 Development

### Project Structure
```
household-manager/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript application logic
├── README.md           # Project documentation
└── .gitignore          # Git ignore file
```

### Key Components
- **HouseholdManager Class** - Main application controller
- **LocalStorage Integration** - Data persistence
- **Event System** - User interaction handling
- **Modal System** - Dynamic form management
- **Notification System** - User feedback

## 🚀 Deployment

### GitHub Pages (Recommended)
1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source branch (usually `main`)
4. Your app will be available at `https://YOUR_USERNAME.github.io/household-manager`

### Other Hosting Options
- **Netlify** - Drag and drop deployment
- **Vercel** - Git-based deployment
- **AWS S3 + CloudFront** - Scalable hosting
- **Firebase Hosting** - Google's hosting platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Font Awesome for icons
- Google Fonts for typography
- Modern CSS techniques for responsive design

## 📞 Support

If you have any questions or need help, please open an issue on GitHub.

---

**Made with ❤️ for better household management**
