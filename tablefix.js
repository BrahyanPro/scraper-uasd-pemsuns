const fs = require('fs').promises
const path = require('path')

async function analyzeShortestCareers () {
  try {
    // Leer el archivo JSON
    const filePath = path.join(__dirname, 'carreras', 'career_analysis.json')
    const rawData = await fs.readFile(filePath, 'utf8')
    const analysisData = JSON.parse(rawData)

    // Ordenar las carreras por duración (semestres)
    const sortedCareers = analysisData.allCareers.sort((a, b) => a.semesterCount - b.semesterCount)

    // Tomar las 10 carreras más cortas
    const shortestCareers = sortedCareers.slice(0, 10)

    // Crear la tabla para console.log
    console.log('\nLas 10 carreras de menor duración:')
    console.log('---------------------------------------------------------------------------------------------------')
    console.log('| Carrera                          | Facultad            | Escuela             | Semestres | Años  |')
    console.log('---------------------------------------------------------------------------------------------------')

    shortestCareers.forEach(career => {
      const years = (career.semesterCount * 6 / 12).toFixed(1) // 6 meses por semestre
      console.log(
                `| ${padRight(career.title, 32)} | ${padRight(career.faculty, 20)} | ${padRight(career.school, 20)} | ${padRight(career.semesterCount.toString(), 9)} | ${padRight(years, 5)} |`
      )
    })

    console.log('---------------------------------------------------------------------------------------------------')
  } catch (error) {
    console.error('Error al leer o procesar el archivo:', error)
  }
}

// Función auxiliar para rellenar strings a la derecha
function padRight (str, length) {
  return str.length > length ? str.slice(0, length - 3) + '...' : str.padEnd(length)
}

analyzeShortestCareers()
