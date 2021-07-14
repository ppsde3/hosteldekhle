const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const multer = require('multer');
const aws = require('aws-sdk');
const multerSharp = require('multer-sharp-s3');

//AWS S3 - Uploading Pictures
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  fileFilter: multerFilter,
  storage: multerSharp({
    Key: (req, file, cb) => {
      const strOne = 'userPiC-';
      const userId = `${req.user._id}-`;
      const todaysDate = `${Date.now().toString()}.`;
      const extension = file.mimetype.split('/')[1];
      const finalStr = strOne.concat(userId, todaysDate, extension);
      cb(null, finalStr);
    },
    s3,
    Bucket: process.env.AWS_BUCKET_NAME,
    ACL: 'public-read',
    resize: {
      width: 500,
      height: 500,
    },
    toFormat: {
      type: 'jpeg',
      options: {
        progressive: true,
        quality: 100,
      },
    },
  }),
});

// exports.uploadUserPhoto = upload.single('profilePicture');
exports.uploadUserPhoto = upload.fields([
  {
    name: 'profilePicture',
    maxCount: 1,
  },
  {
    name: 'pictures',
    maxCount: 3,
  },
]);
// End of AWS Code

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el]; // The same as: name = req.body.name
    }
  });
  return newObj;
}; //Array with the allowed arguments to be updated

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();

  // SEND RESPONSE
  res.status(200).json({
    status: 200,
    results: users.length,
    data: {
      users,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate({
    path: 'myListings',
    select:
      '_id title pictures type city state country zip rent utilitiesIncl -owner',
  });

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 200,
    data: {
      user,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create an error if the user tries to update the passwordChangedAt
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates.', 400));
  }
  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    'name',
    'email',
    'profilePicture',
    'about',
    'age',
    'college'
  );
  if (Object.keys(req.files).length > 0)
    filteredBody.profilePicture = req.files.profilePicture[0].key;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: 'sucess', data: { user: updatedUser } });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({ status: 'sucess', data: null });
});
