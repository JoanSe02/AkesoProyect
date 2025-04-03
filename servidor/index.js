const express = require('express');
const mysql = require('mysql2/promise'); // Usamos la versión con promesas
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();

// Configuración de middleware
app.use(cors());
app.use(express.json());

// Configuración del pool de conexiones MySQL
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '12345678',
  database: 'mascotas_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificar conexión a la base de datos al iniciar
pool.getConnection()
  .then(connection => {
    console.log('Conectado a MySQL');
    connection.release();
  })
  .catch(err => {
    console.error('Error conectando a MySQL:', err);
  });

/**
 * Endpoint para login
 */
app.post('/login', async (req, res) => {
  let connection;
  try {
    const { email, contrasena } = req.body;
    
    if (!email || !contrasena) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email y contraseña son requeridos' 
      });
    }

    connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT * FROM usuarios WHERE email = ?', 
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas' 
      });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(contrasena, user.contrasena);
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas' 
      });
    }

    // Eliminamos la contraseña del objeto usuario antes de enviarlo
    delete user.contrasena;
    
    res.json({ 
      success: true, 
      message: 'Inicio de sesión exitoso', 
      user 
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor',
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Endpoint para registro de usuarios
 */
app.post('/register', async (req, res) => {
  let connection;
  try {
    const { 
      tipo_doc, 
      id_usuario, 
      nombre, 
      apellido, 
      ciudad, 
      direccion, 
      telefono, 
      fecha_nacimiento,
      email, 
      contrasena, 
      id_tipo = 1, // Valor por defecto para Invitado/Tutor
      id_rol = 3   // Valor por defecto para Propietario
    } = req.body;

    // Validaciones básicas
    if (!email || !contrasena || !id_usuario || !nombre || !apellido) {
      return res.status(400).json({ 
        success: false, 
        message: 'Campos obligatorios faltantes' 
      });
    }

    // Verificar si el usuario ya existe
    connection = await pool.getConnection();
    const [existingUsers] = await connection.query(
      'SELECT * FROM usuarios WHERE email = ? OR id_usuario = ?',
      [email, id_usuario]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'El email o documento ya están registrados' 
      });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    // Insertar nuevo usuario
    await connection.query(
      `INSERT INTO usuarios(
        tipo_doc, id_usuario, nombre, apellido, ciudad, 
        direccion, telefono, fecha_nacimiento, email, 
        contrasena, id_tipo, id_rol
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo_doc, id_usuario, nombre, apellido, ciudad, 
        direccion, telefono, fecha_nacimiento, email, 
        hashedPassword, id_tipo, id_rol
      ]
    );

    res.status(201).json({ 
      success: true,
      message: 'Usuario creado con éxito',
      userId: id_usuario
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear el usuario',
      error: error.message,
      code: error.code
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/create', async (req, res) => {
    let connection;
    try {
        console.log('📩 Datos recibidos:', req.body);

        const { nombre, especie, raza, edad, peso, id_usuario, foto } = req.body;

        if (!nombre || !especie || !raza || !edad || !peso || !id_usuario) {
            return res.status(400).json({ message: "⚠️ Todos los campos son obligatorios" });
        }

        connection = await pool.getConnection();
        const query = `INSERT INTO mascotas (nombre, especie, raza, edad, peso, id_usuario, foto) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        const [result] = await connection.query(query, [nombre, especie, raza, edad, peso, id_usuario, foto]);

        res.status(201).json({ 
            success: true,
            message: '✅ Mascota creada correctamente',
            insertId: result.insertId
        });

    } catch (err) {
        console.error('❌ Error al insertar mascota:', err.message, err.code, err.stack);
        res.status(500).json({ message: 'Error al crear la mascota', error: err.message });
    } finally {
        if (connection) connection.release(); // Liberar la conexión
    }
});

// Iniciar el servidor
const PORT = 5000; // Puedes usar el puerto que prefieras
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});