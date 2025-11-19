// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Простая база данных в памяти (для демонстрации)
let database = {
  categories: [
    { id: 1, name: 'Напитки', active: true },
    { id: 2, name: 'Основные блюда', active: true },
    { id: 3, name: 'Десерты', active: true }
  ],
  items: [
    { id: 1, name: 'Кока-Кола', price: 2.50, categoryId: 1, active: true },
    { id: 2, name: 'Вода', price: 1.00, categoryId: 1, active: true },
    { id: 3, name: 'Картофель фри', price: 3.50, categoryId: 2, active: true },
    { id: 4, name: 'Мороженое', price: 4.00, categoryId: 3, active: true }
  ],
  orders: [],
  employees: [
    { id: 1, name: 'Админ', role: 'admin', pin: '1234' },
    { id: 2, name: 'Официант', role: 'waiter', pin: '5678' },
    { id: 3, name: 'Пользователь', role: 'user', pin: '000' }
  ],
  tables: [
    { id: 1, name: 'Стол 1', seats: 2, status: 'free' },
    { id: 2, name: 'Стол 2', seats: 4, status: 'free' },
    { id: 3, name: 'Стол 3', seats: 6, status: 'free' }
  ],
  paymentMethods: [
    { id: 1, name: 'Наличные', code: 'cash', createdAt: new Date().toISOString() },
    { id: 2, name: 'Карта', code: 'card', createdAt: new Date().toISOString() },
    { id: 3, name: 'Агрегаторы', code: 'aggregators', createdAt: new Date().toISOString() }
  ]
};

let nextOrderId = 1;

// API Routes

// Аутентификация
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  const employee = database.employees.find(emp => emp.pin === pin);

  if (employee) {
    res.json({ 
      success: true, 
      employee: { 
        id: employee.id, 
        name: employee.name, 
        role: employee.role 
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Неверный PIN' });
  }
});

// Получить все категории
app.get('/api/categories', (req, res) => {
  res.json(database.categories.filter(cat => cat.active));
});

// Получить все товары
app.get('/api/items', (req, res) => {
  const { categoryId } = req.query;
  let items = database.items.filter(item => item.active);

  if (categoryId) {
    items = items.filter(item => item.categoryId == categoryId);
  }

  res.json(items);
});

// Получить все столы
app.get('/api/tables', (req, res) => {
  res.json(database.tables);
});

// Создать новый заказ
app.post('/api/orders', (req, res) => {
  const { tableId, employeeId, items, total } = req.body;

  const order = {
    id: nextOrderId++,
    tableId,
    employeeId,
    items,
    total,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  database.orders.push(order);

  // Обновить статус стола
  const table = database.tables.find(t => t.id === tableId);
  if (table) {
    table.status = 'occupied';
  }

  res.json({ success: true, orderId: order.id });
});

// Получить все заказы
app.get('/api/orders', (req, res) => {
  res.json(database.orders);
});

// Получить заказ по ID
app.get('/api/orders/:id', (req, res) => {
  const order = database.orders.find(o => o.id == req.params.id);
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: 'Заказ не найден' });
  }
});

// Обновить статус заказа
app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const order = database.orders.find(o => o.id == req.params.id);

  if (order) {
    order.status = status;

    // Если заказ закрыт, освободить стол
    if (status === 'closed') {
      const table = database.tables.find(t => t.id === order.tableId);
      if (table) {
        table.status = 'free';
      }
    }

    res.json({ success: true });
  } else {
    res.status(404).json({ message: 'Заказ не найден' });
  }
});

// Обработать оплату
app.post('/api/orders/:id/payment', (req, res) => {
  const { paymentMethod, amount } = req.body;
  const order = database.orders.find(o => o.id == req.params.id);

  if (order) {
    order.paymentMethod = paymentMethod;
    order.paidAmount = amount;
    order.status = 'paid';
    order.paidAt = new Date().toISOString();

    res.json({ success: true });
  } else {
    res.status(404).json({ message: 'Заказ не найден' });
  }
});

// Освободить столик
app.put('/api/tables/:id/free', (req, res) => {
  const tableId = parseInt(req.params.id);
  const table = database.tables.find(t => t.id === tableId);

  if (table) {
    table.status = 'free';
    res.json({ success: true, message: 'Столик освобожден' });
  } else {
    res.status(404).json({ success: false, message: 'Столик не найден' });
  }
});

// Добавить новый товар
app.post('/api/items', (req, res) => {
  const { name, price, categoryId } = req.body;

  if (!name || !price || !categoryId) {
    return res.status(400).json({ success: false, message: 'Все поля обязательны' });
  }

  const newItem = {
    id: Math.max(...database.items.map(item => item.id), 0) + 1,
    name,
    price: parseFloat(price),
    categoryId: parseInt(categoryId),
    active: true
  };

  database.items.push(newItem);
  res.json({ success: true, item: newItem });
});

// Обновить товар
app.put('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const { name, price, categoryId } = req.body;

  const item = database.items.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Товар не найден' });
  }

  if (name) item.name = name;
  if (price) item.price = parseFloat(price);
  if (categoryId) item.categoryId = parseInt(categoryId);

  res.json({ success: true, item });
});

// Удалить товар
app.delete('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = database.items.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).json({ success: false, message: 'Товар не найден' });
  }

  item.active = false;
  res.json({ success: true, message: 'Товар удален' });
});

// Добавить новую категорию
app.post('/api/categories', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Название категории обязательно' });
  }

  const newCategory = {
    id: Math.max(...database.categories.map(cat => cat.id), 0) + 1,
    name,
    active: true
  };

  database.categories.push(newCategory);
  res.json({ success: true, category: newCategory });
});

// Удалить категорию
app.delete('/api/categories/:id', (req, res) => {
  const categoryId = parseInt(req.params.id);
  const category = database.categories.find(c => c.id === categoryId);

  if (!category) {
    return res.status(404).json({ success: false, message: 'Категория не найдена' });
  }

  category.active = false;
  res.json({ success: true, message: 'Категория удалена' });
});

// Получить статистику
app.get('/api/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = database.orders.filter(order => 
    order.createdAt.startsWith(today)
  );

  const totalSales = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const openOrders = database.orders.filter(order => order.status === 'new' || order.status === 'preparing').length;
  const occupiedTables = database.tables.filter(table => table.status === 'occupied').length;

  res.json({
    totalOrders: todayOrders.length,
    totalSales: totalSales,
    openOrders: openOrders,
    occupiedTables: occupiedTables
  });
});

// Получить методы оплаты
app.get('/api/payment-methods', (req, res) => {
  res.json(database.paymentMethods || []);
});

// Добавить метод оплаты
app.post('/api/payment-methods', (req, res) => {
  const { name, code } = req.body;

  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Название и код обязательны' });
  }

  // Проверить, что код уникален
  const existingMethod = database.paymentMethods.find(pm => pm.code === code);
  if (existingMethod) {
    return res.status(400).json({ success: false, message: 'Метод оплаты с таким кодом уже существует' });
  }

  const newMethod = {
    id: Date.now(),
    name,
    code,
    createdAt: new Date().toISOString()
  };

  if (!database.paymentMethods) {
    database.paymentMethods = [];
  }

  database.paymentMethods.push(newMethod);
  res.json({ success: true, method: newMethod });
});

// Удалить метод оплаты
app.delete('/api/payment-methods/:id', (req, res) => {
  const methodId = parseInt(req.params.id);
  const index = database.paymentMethods.findIndex(pm => pm.id === methodId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Метод оплаты не найден' });
  }

  database.paymentMethods.splice(index, 1);
  res.json({ success: true, message: 'Метод оплаты удален' });
});

// Обслуживание фронтенда
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 POS Server запущен на порту ${PORT}`);
  console.log(`📱 Откройте http://localhost:${PORT} для доступа к системе`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Сервер завершает работу...');
  process.exit(0);
});

module.exports = app;