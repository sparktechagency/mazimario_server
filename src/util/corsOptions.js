const corsOptions = {
    origin: [
      "http://10.10.20.54:3000",
      "http://localhost:3000",
      "http://localhost:3080"
    ],
    credentials: true,
  };
module.exports = corsOptions;
