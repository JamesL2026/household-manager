# AWS S3 Deployment - Step by Step

## Prerequisites
- AWS Account (free tier available)
- Your household manager files ready

## Step 1: Create S3 Bucket
1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click "Create bucket"
3. **Bucket name**: `household-manager-[your-name]` (must be globally unique)
4. **Region**: Choose closest to your users
5. **Public access**: Uncheck "Block all public access"
6. **Bucket versioning**: Disabled
7. **Default encryption**: None
8. Click "Create bucket"

## Step 2: Enable Static Website Hosting
1. Click on your bucket name
2. Go to "Properties" tab
3. Scroll to "Static website hosting"
4. Click "Edit"
5. **Static website hosting**: Enable
6. **Index document**: `index.html`
7. **Error document**: `index.html` (for SPA routing)
8. Click "Save changes"

## Step 3: Upload Files
1. Go to "Objects" tab
2. Click "Upload"
3. Add files: `index.html`, `styles.css`, `script.js`
4. Click "Upload"

## Step 4: Set Public Permissions
1. Select all uploaded files
2. Click "Actions" → "Make public"
3. Confirm the action

## Step 5: Get Your Website URL
1. Go to "Properties" tab
2. Scroll to "Static website hosting"
3. Copy the "Bucket website endpoint" URL
4. Your site is now live! 🎉

## Step 6: Optional - Custom Domain
1. Buy domain from Route 53 or external provider
2. Create CloudFront distribution
3. Point domain to CloudFront
4. Enable HTTPS

## Testing Your Deployment
- Visit your S3 website URL
- Test all features (chores, notifications, etc.)
- Verify data persists in browser
- Test on mobile devices

## Cost Estimate
- S3 Storage: ~$0.023/GB/month
- Data Transfer: ~$0.09/GB
- **Total**: $1-3/month for typical usage

## Troubleshooting
- **403 Forbidden**: Check bucket permissions
- **404 Not Found**: Verify file names and paths
- **CORS issues**: Add CORS policy if needed
- **HTTPS**: Use CloudFront for HTTPS support
