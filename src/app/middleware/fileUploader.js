const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3Client } = require("../../util/s3.util");

const allowedMimeTypes = [
  // Image types
  "image/jpeg", 
  "image/png", 
  "image/jpg", 
  "image/webp",
  // Video types
  "video/mp4",
  "video/avi",
  "video/mov",
  "video/wmv",
  "video/flv",
  "video/webm",
  "video/mkv",
  "video/3gp",
  // PDF type
  "application/pdf"
];

const isValidFileType = (mimetype) => allowedMimeTypes.includes(mimetype);

const uploadFile = () => {
  const storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Create folder structure: fieldname/timestamp-originalname
      const fileName = `${Date.now()}-${file.originalname}`;
      const key = `${file.fieldname}/${fileName}`;
      
      // Store uploaded file URLs in req.uploadedFiles for tracking
      if (!req.uploadedFiles) req.uploadedFiles = [];
      
      // The S3 URL will be available in file.location after upload
      cb(null, key);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedFieldNames = [
      "profile_image", 
      "post_image", 
      "attachments", 
      "icon", 
      "licenses", 
      "certificates", 
      "completionProof"
    ];

    // Allow requests without files (when there's no fieldname)
    if (!file.fieldname) return cb(null, true);

    // Check if the fieldname is valid
    if (!allowedFieldNames.includes(file.fieldname))
      return cb(new Error("Invalid fieldname"));

    // Check if the file type is valid
    if (isValidFileType(file.mimetype)) return cb(null, true);
    else return cb(new Error("Invalid file type"));
  };

  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for attachments (videos can be large)
    },
  }).fields([
    { name: "profile_image", maxCount: 1 },
    { name: "post_image", maxCount: 1 },
    { name: "attachments", maxCount: 5 },
    { name: "icon", maxCount: 1 },
    { name: "licenses", maxCount: 5 },
    { name: "certificates", maxCount: 5 },
    { name: "completionProof", maxCount: 5 },
  ]);

  return upload;
};

// Separate upload function for chat files
const uploadChatFiles = () => {
  const storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const fileName = `${Date.now()}-${file.originalname}`;
      const key = `${file.fieldname}/${fileName}`;
      
      if (!req.uploadedFiles) req.uploadedFiles = [];
      
      cb(null, key);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedFieldNames = ["chatImage", "chatVideo", "chatVideoCover"];
    if (!file.fieldname) return cb(null, true);
    if (!allowedFieldNames.includes(file.fieldname))
      return cb(new Error("Invalid fieldname"));
    if (isValidFileType(file.mimetype)) return cb(null, true);
    else return cb(new Error("Invalid file type"));
  };

  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  }).fields([
    { name: "chatImage", maxCount: 10 },
    { name: "chatVideo", maxCount: 1 },
    { name: "chatVideoCover", maxCount: 1 },
  ]);
};

module.exports = { uploadFile, uploadChatFiles };
