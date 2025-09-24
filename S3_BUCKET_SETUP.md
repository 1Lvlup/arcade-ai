# S3 Bucket Configuration for Figure Display

## Required S3 Bucket Policy

To allow figures to be displayed directly in the web application, your S3 bucket needs a public read policy. Add this policy to your S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::arcade-postparse-images/*"
    }
  ]
}
```

## Steps to Configure:

1. **Go to AWS S3 Console**
   - Navigate to your bucket (`arcade-postparse-images`)

2. **Update Block Public Access Settings**
   - Go to "Permissions" tab
   - Click "Edit" on "Block public access"
   - Uncheck "Block all public access"
   - Save changes

3. **Add Bucket Policy**
   - Still in "Permissions" tab
   - Scroll to "Bucket policy"
   - Click "Edit"
   - Paste the JSON policy above
   - Save changes

## Security Note

This policy allows public read access to all objects in the bucket. For enhanced security, consider:

- Using presigned URLs for temporary access
- Implementing object-level permissions
- Adding IP restrictions if needed

## Verification

After applying the policy, test that images are accessible by visiting:
`https://arcade-postparse-images.s3.us-east-2.amazonaws.com/manuals/[manual-id]/[figure-id].png`