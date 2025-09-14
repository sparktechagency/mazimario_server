const { default: status } = require("http-status");
const Provider = require("./Provider");
const Auth = require("../auth/Auth");
const User = require("../user/User");
const QueryBuilder = require("../../../builder/queryBuilder");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const unlinkFile = require("../../../util/unlinkFile");

const registerProvider = async (req) => {
  const { files, body: data, user } = userData;
  const { authId } = user;

  validateFields(data, [
    "companyName",
    "serviceCategory",
    "subcategory",
    "serviceLocation",
    "contactPerson",
  ]);

  // Check if provider already exists
  const existingProvider = await Provider.findOne({ authId });
  if (existingProvider) {
    throw new ApiError(status.BAD_REQUEST, "Provider already registered");
  }

  // Check if user exists
  const userExists = await User.findOne({ authId });
  if (!userExists) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const providerData = {
    authId,
    companyName: data.companyName,
    website: data.website,
    serviceCategory: data.serviceCategory,
    subcategory: data.subcategory,
    workingHours: data.workingHours || [],
    serviceLocation: data.serviceLocation,
    contactPerson: data.contactPerson,
  };

  // Handle file uploads for licenses and certificates
  if (files && files.licenses) {
    providerData.licenses = files.licenses.map((file, index) => ({
      name: data.licenseNames ? data.licenseNames[index] : `License ${index + 1}`,
      file: file.path,
      expiryDate: data.licenseExpiryDates ? data.licenseExpiryDates[index] : null,
    }));
  }

  if (files && files.certificates) {
    providerData.certificates = files.certificates.map((file, index) => ({
      name: data.certificateNames ? data.certificateNames[index] : `Certificate ${index + 1}`,
      file: file.path,
      issuingAuthority: data.certificateAuthorities ? data.certificateAuthorities[index] : null,
      issueDate: data.certificateIssueDates ? data.certificateIssueDates[index] : null,
    }));
  }

  const provider = await Provider.create(providerData);

  return provider;
};

const getProviderProfile = async (userData) => {
  const { authId } = userData;

  const provider = await Provider.findOne({ authId })
    .populate("serviceCategory")
    .populate("subcategory")
    .lean();

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  return provider;
};

const updateProviderProfile = async (req) => {
  const { files, body: data, user } = req;
  const { authId } = user;

  const existingProvider = await Provider.findOne({ authId });
  if (!existingProvider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  const updateData = { ...data };

  // Handle file uploads for licenses
  if (files && files.licenses) {
    // Remove old license files
    if (existingProvider.licenses && existingProvider.licenses.length > 0) {
      existingProvider.licenses.forEach(license => {
        if (license.file) unlinkFile(license.file);
      });
    }

    updateData.licenses = files.licenses.map((file, index) => ({
      name: data.licenseNames ? data.licenseNames[index] : `License ${index + 1}`,
      file: file.path,
      expiryDate: data.licenseExpiryDates ? data.licenseExpiryDates[index] : null,
    }));
  }

  // Handle file uploads for certificates
  if (files && files.certificates) {
    // Remove old certificate files
    if (existingProvider.certificates && existingProvider.certificates.length > 0) {
      existingProvider.certificates.forEach(certificate => {
        if (certificate.file) unlinkFile(certificate.file);
      });
    }

    updateData.certificates = files.certificates.map((file, index) => ({
      name: data.certificateNames ? data.certificateNames[index] : `Certificate ${index + 1}`,
      file: file.path,
      issuingAuthority: data.certificateAuthorities ? data.certificateAuthorities[index] : null,
      issueDate: data.certificateIssueDates ? data.certificateIssueDates[index] : null,
    }));
  }

  const provider = await Provider.findOneAndUpdate(
    { authId },
    updateData,
    { new: true, runValidators: true }
  )
    .populate("serviceCategory")
    .populate("subcategory");

  return provider;
};

const getAllProviders = async (userData, query) => {
  const providerQuery = new QueryBuilder(
    Provider.find({})
      .populate("serviceCategory")
      .populate("subcategory")
      .populate({
        path: "authId",
        select: "name email",
      })
      .lean(),
    query
  )
    .search(["companyName", "serviceLocation"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [providers, meta] = await Promise.all([
    providerQuery.modelQuery,
    providerQuery.countTotal(),
  ]);

  return {
    meta,
    providers,
  };
};

const getProviderById = async (query) => {
  validateFields(query, ["providerId"]);

  const provider = await Provider.findById(query.providerId)
    .populate("serviceCategory")
    .populate("subcategory")
    .populate({
      path: "authId",
      select: "name email",
    })
    .lean();

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  return provider;
};

const updateProviderVerification = async (userData, payload) => {
  validateFields(payload, ["providerId", "isVerified"]);

  const provider = await Provider.findByIdAndUpdate(
    payload.providerId,
    { isVerified: payload.isVerified },
    { new: true, runValidators: true }
  )
    .populate("serviceCategory")
    .populate("subcategory");

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  return provider;
};

const updateProviderStatus = async (userData, payload) => {
  validateFields(payload, ["providerId", "isActive"]);

  const provider = await Provider.findByIdAndUpdate(
    payload.providerId,
    { isActive: payload.isActive },
    { new: true, runValidators: true }
  );

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  return provider;
};

const deleteProvider = async (userData, payload) => {
  validateFields(payload, ["providerId"]);

  const provider = await Provider.findById(payload.providerId);
  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  // Remove associated files
  if (provider.licenses && provider.licenses.length > 0) {
    provider.licenses.forEach(license => {
      if (license.file) unlinkFile(license.file);
    });
  }

  if (provider.certificates && provider.certificates.length > 0) {
    provider.certificates.forEach(certificate => {
      if (certificate.file) unlinkFile(certificate.file);
    });
  }

  await Provider.findByIdAndDelete(payload.providerId);

  return { message: "Provider deleted successfully" };
};

const getProvidersByCategory = async (query) => {
  validateFields(query, ["categoryId"]);

  const providersQuery = new QueryBuilder(
    Provider.find({ serviceCategory: query.categoryId, isVerified: true, isActive: true })
      .populate("serviceCategory")
      .populate("subcategory")
      .populate({
        path: "authId",
        select: "name email",
      })
      .lean(),
    query
  )
    .search(["companyName", "serviceLocation"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [providers, meta] = await Promise.all([
    providersQuery.modelQuery,
    providersQuery.countTotal(),
  ]);

  return {
    meta,
    providers,
  };
};

const ProviderService = {
  registerProvider,
  getProviderProfile,
  updateProviderProfile,
  getAllProviders,
  getProviderById,
  updateProviderVerification,
  updateProviderStatus,
  deleteProvider,
  getProvidersByCategory,
};

module.exports = { ProviderService };