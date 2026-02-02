import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (id, role) => {
  let accessToken = await jwt.sign({ id, role }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_SECRET_EXPIRY,
  });
  let refreshToken = await jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_SECRET_EXPIRY,
  });
  return { accessToken, refreshToken };
};

export { generateAccessAndRefreshToken };
