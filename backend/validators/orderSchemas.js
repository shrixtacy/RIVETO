import Joi from 'joi';

export const placeOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            'string.pattern.base': 'Invalid product ID format',
            'any.required': 'Product ID is required'
          }),
        size: Joi.string()
          .trim()
          .min(1)
          .max(10)
          .required()
          .messages({
            'string.empty': 'Size is required',
            'any.required': 'Size is required'
          }),
        quantity: Joi.number()
          .integer()
          .min(1)
          .max(100)
          .required()
          .messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be at least 1',
            'number.max': 'Quantity cannot exceed 100',
            'any.required': 'Quantity is required'
          })
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Order must contain at least one item',
      'any.required': 'Items are required'
    }),

  amount: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required'
    }),

  address: Joi.object({
    firstname: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .required()
      .messages({
        'string.empty': 'First name is required',
        'any.required': 'First name is required'
      }),
    lastname: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .required()
      .messages({
        'string.empty': 'Last name is required',
        'any.required': 'Last name is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Invalid email format',
        'any.required': 'Email is required'
      }),
    street: Joi.string()
      .trim()
      .min(5)
      .max(200)
      .required()
      .messages({
        'string.empty': 'Street address is required',
        'string.min': 'Street address must be at least 5 characters',
        'any.required': 'Street address is required'
      }),
    city: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.empty': 'City is required',
        'any.required': 'City is required'
      }),
    state: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.empty': 'State is required',
        'any.required': 'State is required'
      }),
    pincode: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'Pincode must be 6 digits',
        'any.required': 'Pincode is required'
      }),
    country: Joi.string()
      .trim()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.empty': 'Country is required',
        'any.required': 'Country is required'
      }),
    phone: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid phone number format',
        'any.required': 'Phone number is required'
      })
  }).required()
});

export const updateStatusSchema = Joi.object({
  orderId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid order ID format',
      'any.required': 'Order ID is required'
    }),
  status: Joi.string()
    .valid('Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')
    .required()
    .messages({
      'any.only': 'Invalid status value',
      'any.required': 'Status is required'
    })
});
