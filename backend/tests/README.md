# Order Security Tests

## Overview
This test suite validates the security fixes implemented for issue #101, ensuring order placement is secure and atomic.

## Prerequisites
- MongoDB running locally on port 27017 (or configure MONGODB_URI_TEST in .env.test)
- Node.js installed
- Dependencies installed: `npm install`

## Running Tests

```bash
# Install dependencies (including jest and supertest)
npm install

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test orderSecurity.test.js
```

## Test Coverage

The test suite covers:

1. **Price Manipulation Prevention**: Ensures server-side price calculation
2. **Product Validation**: Rejects orders with non-existent products
3. **Size Validation**: Rejects invalid sizes for products
4. **Stock Validation**: Prevents orders exceeding available stock
5. **Address Validation**: Requires complete delivery address
6. **Amount Calculation**: Verifies correct total calculation
7. **Legacy Product Handling**: Gracefully handles products without stock maps
8. **Atomicity**: Ensures order creation, stock decrement, and cart clearing happen together or not at all
9. **Stock Decrement**: Verifies stock is properly reduced when orders are placed
10. **Stock Rollback**: Ensures stock remains unchanged if order fails

## Configuration

Test environment variables are in `.env.test`:
- `MONGODB_URI_TEST`: Test database connection string
- `JWT_SECRET`: Secret for generating test tokens
- `PORT`: Test server port (different from dev/prod)

## Notes

- Tests use a separate test database to avoid affecting development data
- Each test creates fresh test data and cleans up after itself
- Authentication is mocked using JWT tokens for testing
- The app export from index.js allows supertest to test without starting the server
