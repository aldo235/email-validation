## Email Validator
Uses Node.js 10 native workers and utilizes all cores in the email verification process

### Scrape part
Scrapes the login form for the domains *gmail.com*, *hotmail.com*, *outlook.com*, *aol.com*, *yahoo.com* and achieves 100% accuracy.

### SMTP part
For all other domains and SMTP connections is made. Checks for MX records first. The best server is chosen.
