const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

// Initialize S3 client with credentials from environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to S3
 * @param {Object} file - File object from multer
 * @param {string} folder - Folder name in S3 bucket (e.g., 'profile_image', 'attachments')
 * @returns {Promise<string>} - S3 URL of uploaded file
 */
const uploadToS3 = async (file, folder) => {
  try {
    const fileName = `${Date.now()}-${file.originalname}`;
    const key = `${folder}/${fileName}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    const result = await upload.done();
    
    // Return the public URL
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
};

/**
 * Delete a file from S3
 * @param {string} fileUrl - Full S3 URL of the file to delete
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract the key from the URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`Successfully deleted file from S3: ${key}`);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw new Error(`S3 deletion failed: ${error.message}`);
  }
};

/**
 * Delete multiple files from S3
 * @param {string[]} fileUrls - Array of S3 URLs to delete
 * @returns {Promise<void>}
 */
const deleteMultipleFromS3 = async (fileUrls) => {
  try {
    const deletePromises = fileUrls.map((url) => deleteFromS3(url));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting multiple files from S3:", error);
    throw error;
  }
};

module.exports = {
  s3Client,
  uploadToS3,
  deleteFromS3,
  deleteMultipleFromS3,
};
