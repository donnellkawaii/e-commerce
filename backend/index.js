const port = 4000;
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { strict } = require('assert');
const { log } = require('console');

app.use(express.json());
app.use(cors());

// databsec connection with mongodb
mongoose.connect('mongodb+srv://ecommerce:test@cluster0.zb5cmdt.mongodb.net/e-commerce');

// api creation

app.get('/', (req, res) => {
  res.send('Express app is running')
})

// image storage engine
const storage = multer.diskStorage({
  destination: './upload/images',
  filename: (req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
  }
})

const upload = multer({ storage: storage })

// creating upload endpoint
app.use('/images', express.static('upload/images'));

app.post('/upload', upload.single('product'), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`
  });
});


// Schema for creating products

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  new_price: {
    type: Number,
    required: true
  },
  old_price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  available: {
    type: Boolean,
    default: true
  }
})

app.post('/addproduct', async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }


  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price
  });
  console.log(product);
  await product.save();
  console.log('Save')
  res.json({
    success: true,
    name: req.body.name
  })
})

//Creating apu for deleting products

app.post('/removeproduct', async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("removed")
  res.json({
    success: true,
    name: req.body.name
  })
})

// Creating API for getting all products

app.get('/allproducts', async (req, res) => {
  let products = await Product.find({});
  console.log("all products fetched")
  res.send(products);
})

// Schema creating for User model

const Users = mongoose.model('Users', {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now
  }
})

//Creating endpoint for registering the user
app.post('/signup', async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, error: "existing user" })
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  })
  await user.save();

  const data = {
    user: {
      id: user.id
    }
  }
  const token = jwt.sign(data, 'secret_ecom');
  res.json({ success: true, token })
})

// creating endpoint for user login
app.post('/login', async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id
        }
      }
      const token = jwt.sign(data, 'secret_ecom');
      res.json({ success: true, token })
    }
    else {
      res.json({ success: false, error: "Wrong password" })
    }
  }
  else {
    res.json({ success: false, error: "Wrong email id" })
  }
})

// creating endpoint for newcollection data
app.get('/newcollections', async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("new collection fetched")
  res.send(newcollection)
})

//creating endpoint for popular in women section
app.get('/popularinwoman', async (req, res) => {
  let products = await Product.find({ category: 'women' })
  let popular_in_woman = products.slice(0, 4);
  console.log("popular in woman fetched")
  res.send(popular_in_woman);
})
//middleware to fecth user
const fetchUser = async (req, res, next) => {
  const token = req.header('auth-token');
  console.log(token)
  if (!token) {
    res.status(401).send({ errors: "Please authenticate using valid token" })
  } else {
    try {
      const data = jwt.verify(token, 'secret_ecom');
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ error: "please authenticate using valid token" })
    }
  }
}
// adding product in cart data
app.post('/addtocart', fetchUser, async (req, res) => {
  try {
    // Retrieve user data from the database
    let userData = await Users.findOne({ _id: req.user.id });

    // Check if cartData exists in userData, if not initialize it
    if (!userData.cartData) {
      userData.cartData = {};
    }

    // Increment the count for the given itemId in cartData
    userData.cartData[req.body.itemId] = (userData.cartData[req.body.itemId] || 0) + 1;

    // Update the user document with the modified cartData
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });

    // Send a success response
    // res.send("Added to cart successfully");
  } catch (error) {
    // Handle any errors that occur during the process
    console.error("Error adding to cart:", error);
    res.status(500).send("Error adding to cart");
  }
});

//remove product from cartdata
app.post('/removefromcart',fetchUser,async (req,res)=>{
  try {
    // Retrieve user data from the database
    let userData = await Users.findOne({ _id: req.user.id });

    // Check if cartData exists in userData, if not initialize it
    if (!userData.cartData) {
      userData.cartData = {};
    }

    // Increment the count for the given itemId in cartData
    userData.cartData[req.body.itemId] = (userData.cartData[req.body.itemId] || 0) - 1;

    // Update the user document with the modified cartData
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });

    // Send a success response
    // res.send("Added to cart successfully");
  } catch (error) {
    // Handle any errors that occur during the process
    console.error("Error removing to cart:", error);
    res.status(500).send("Error removing to cart");
  }
})

//get cartdata
app.post('/getcart',fetchUser,async (req,res)=>{
  console.log("GetCart")
  let userData = await Users.findOne({_id:req.user.id});
  res.json(userData.cartData);
})

app.listen(port, (error) => {
  if (!error) {
    console.log('Server running in port: ' + port)
  } else {
    console.log('Error: ' + error)
  }

});
