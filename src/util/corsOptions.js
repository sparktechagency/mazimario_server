const corsOptions = {
  origin: [
    "http://10.10.20.54:3000",
    "http://localhost:3000",
    "http://localhost:3080",
    "http://10.10.20.43:3080",
    "http://3.96.86.190:4173"
  ],
  credentials: true,
};
module.exports = corsOptions;
