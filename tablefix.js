const fs = require('fs').promises
const path = require('path')

async function analyzeShortestCareers () {
  try {
    const filePath = path.join(__dirname, 'carreras', 'career_analysis.json')
    const rawData = await fs.readFile(filePath, 'utf8')
    const analysisData = JSON.parse(rawData)

    const sortedCareers = analysisData.allCareers.sort((a, b) => a.semesterCount - b.semesterCount)
    const shortestCareers = sortedCareers.slice(0, 50)

    console.log('\n\x1b[1mLas 10 carreras de menor duración:\x1b[0m')
    console.log('╔════════════════════════════════════════════════════════════════╦══════════════════════╦══════════════════════╦═══════════╦═══════╗')
    console.log('║ \x1b[1mCarrera\x1b[0m                                                    ║ \x1b[1mFacultad\x1b[0m            ║ \x1b[1mEscuela\x1b[0m             ║ \x1b[1mSemestres\x1b[0m ║ \x1b[1mAños\x1b[0m  ║')
    console.log('╠════════════════════════════════════════════════════════════════╬══════════════════════╬══════════════════════╬═══════════╬═══════╣')

    shortestCareers.forEach((career, index) => {
      const years = (career.semesterCount * 6 / 12).toFixed(1)
      console.log(
        `║ ${padRight(career.title, 60)} ║ ${padRight(career.faculty, 20)} ║ ${padRight(career.school, 20)} ║ ${padCenter(career.semesterCount.toString(), 9)} ║ ${padCenter(years, 5)} ║`
      )

      if (index < shortestCareers.length - 1) {
        console.log('╠════════════════════════════════════════════════════════════════╬══════════════════════╬══════════════════════╬═══════════╬═══════╣')
      }
    })

    console.log('╚════════════════════════════════════════════════════════════════╩══════════════════════╩══════════════════════╩═══════════╩═══════╝')
  } catch (error) {
    console.error('Error al leer o procesar el archivo:', error)
  }
}

function padRight (str, length) {
  return str.length > length ? str.slice(0, length - 3) + '...' : str.padEnd(length)
}

function padCenter (str, length) {
  const spaces = length - str.length
  const padLeft = Math.floor(spaces / 2)
  const padRight = spaces - padLeft
  return ' '.repeat(padLeft) + str + ' '.repeat(padRight)
}

analyzeShortestCareers()
