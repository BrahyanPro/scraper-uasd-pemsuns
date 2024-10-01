const fs = require('fs')
const path = require('path')

// Ruta al directorio principal que contiene los subdirectorios de las facultades
const mainDirectory = './carreras'

// Directorio para guardar los archivos procesados
const outputDirectory = './materias_en_carreras'
if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory)
}

// Función para procesar los archivos JSON recursivamente
function processDirectory (directory) {
  // Leer el contenido del directorio actual
  fs.readdir(directory, { withFileTypes: true }, (err, entries) => {
    if (err) {
      console.error('Error al leer el directorio:', err)
      return
    }

    const processedData = []

    entries.forEach(entry => {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        // Si es un directorio, hacer una llamada recursiva
        processDirectory(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // Leer el contenido del archivo JSON
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
        // Extraer el nombre de la carrera del nombre del archivo
        const careerName = entry.name.replace('.json', '')
        // Extraer los códigos de las asignaturas
        const subjectCodes = data.map(subject => subject.clave)
        // Crear la estructura de datos deseada
        const careerData = {
          carrername: careerName,
          subjects: subjectCodes
        }
        // Agregar la información procesada a la lista
        processedData.push(careerData)
      }
    })

    // Si se encontraron datos procesados, guardarlos en un archivo
    if (processedData.length > 0) {
      const facultyName = path.basename(directory)
      const outputFilename = path.join(outputDirectory, `${facultyName}_subjects.json`)
      fs.writeFileSync(outputFilename, JSON.stringify(processedData, null, 4))
      console.log('Archivo generado correctamente:', outputFilename)
    }
  })
}

// Llamar a la función para procesar los archivos empezando desde el directorio principal
processDirectory(mainDirectory)
