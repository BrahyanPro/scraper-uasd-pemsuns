const playwright = require('playwright')
const fs = require('fs').promises
const path = require('path')

const folderPath = path.join(__dirname, 'carreras')

async function analyzeCareerData () {
  console.time('Tiempo de ejecución')
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage()
  await page.goto('https://soft.uasd.edu.do/planesgrado/')

  const faculties = await extractFacultiesData(page)
  const careerData = await extractCareerDetails(browser, faculties)

  await browser.close()

  const analysis = analyzeData(careerData)
  await saveAnalysisToFile(analysis)
  printAnalysis(analysis)

  console.timeEnd('Tiempo de ejecución')
}

async function extractFacultiesData (page) {
  return await page.evaluate(() => {
    const div = document.querySelector('.tree#tvCarreras')
    const tables = div.querySelectorAll(':scope > table')

    function getSchoolsData (schools) {
      const schoolData = []
      const tables = schools.querySelectorAll(':scope > table')
      tables.forEach(table => {
        const schoolName = table.querySelector('.tvCarreras_0').innerText
        const nextSibling = table.nextElementSibling
        const careers = Array.from(
          nextSibling.querySelectorAll('.tvCarreras_0[target="_blank"]')
        ).map(link => ({ title: link.innerText, url: link.href }))
        schoolData.push({ name: schoolName, careers })
      })
      return schoolData
    }

    return Array.from(tables).map(table => {
      const facultyName = table.querySelector('.tvCarreras_0').innerText
      const schools = getSchoolsData(table.nextElementSibling)
      return { faculty: facultyName, data: schools }
    })
  })
}

async function extractCareerDetails (browser, faculties) {
  const careerData = []

  for (const faculty of faculties) {
    console.log(`Analizando facultad: ${faculty.faculty}`)

    for (const school of faculty.data) {
      console.log(`  Escuela: ${school.name}`)

      for (const career of school.careers) {
        console.log(`    Carrera: ${career.title}`)
        const details = await getCareerDetails(browser, career, faculty.faculty, school.name)
        careerData.push(details)
      }
    }
  }

  return careerData
}

async function getCareerDetails (browser, career, facultyName, schoolName) {
  const page = await browser.newPage()
  await page.goto(career.url, { waitUntil: 'networkidle' })

  const details = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#datosPrincipales tr'))
    let currentSemester = ''
    let totalCredits = 0
    let totalTheoryHours = 0
    let totalPracticeHours = 0
    const semesters = new Set()

    for (const row of rows) {
      if (row.cells.length === 1) {
        currentSemester = row.innerText.trim()
        semesters.add(currentSemester)
      } else if (row.cells.length > 1) {
        const [, , ht, hp, cr] = Array.from(row.cells, cell => cell.innerText.trim())
        if (!isNaN(cr)) {
          totalCredits += parseInt(cr)
          totalTheoryHours += parseInt(ht)
          totalPracticeHours += parseInt(hp)
        }
      }
    }

    return {
      totalCredits,
      totalTheoryHours,
      totalPracticeHours,
      semesterCount: semesters.size
    }
  })

  await page.close()

  return {
    title: career.title,
    faculty: facultyName,
    school: schoolName,
    ...details
  }
}

function analyzeData (careerData) {
  const sortedByCredits = [...careerData].sort((a, b) => b.totalCredits - a.totalCredits)
  const sortedByDuration = [...careerData].sort((a, b) => b.semesterCount - a.semesterCount)
  const sortedByTotalHours = [...careerData].sort((a, b) =>
    (b.totalTheoryHours + b.totalPracticeHours) - (a.totalTheoryHours + a.totalPracticeHours)
  )

  const averageCredits = careerData.reduce((sum, career) => sum + career.totalCredits, 0) / careerData.length
  const averageDuration = careerData.reduce((sum, career) => sum + career.semesterCount, 0) / careerData.length

  return {
    totalCareers: careerData.length,
    averageCredits: averageCredits.toFixed(2),
    averageDuration: averageDuration.toFixed(2),
    mostCredits: sortedByCredits[0],
    leastCredits: sortedByCredits[sortedByCredits.length - 1],
    longestDuration: sortedByDuration[0],
    shortestDuration: sortedByDuration[sortedByDuration.length - 1],
    mostTotalHours: sortedByTotalHours[0],
    leastTotalHours: sortedByTotalHours[sortedByTotalHours.length - 1],
    allCareers: careerData
  }
}

async function saveAnalysisToFile (analysis) {
  const filePath = path.join(folderPath, 'career_analysis.json')
  await fs.writeFile(filePath, JSON.stringify(analysis, null, 2)).catch(console.error)
  console.log(`Análisis guardado en: ${filePath}`)
}

function printAnalysis (analysis) {
  console.log('\n--- Análisis de Carreras ---')
  console.log(`Total de carreras analizadas: ${analysis.totalCareers}`)
  console.log(`Promedio de créditos: ${analysis.averageCredits}`)
  console.log(`Promedio de duración (semestres): ${analysis.averageDuration}`)
  console.log(`\nCarrera con más créditos: ${analysis.mostCredits.title} (${analysis.mostCredits.totalCredits} créditos)`)
  console.log(`Carrera con menos créditos: ${analysis.leastCredits.title} (${analysis.leastCredits.totalCredits} créditos)`)
  console.log(`\nCarrera más larga: ${analysis.longestDuration.title} (${analysis.longestDuration.semesterCount} semestres)`)
  console.log(`Carrera más corta: ${analysis.shortestDuration.title} (${analysis.shortestDuration.semesterCount} semestres)`)
  console.log(`\nCarrera con más horas totales: ${analysis.mostTotalHours.title} (${analysis.mostTotalHours.totalTheoryHours + analysis.mostTotalHours.totalPracticeHours} horas)`)
  console.log(`Carrera con menos horas totales: ${analysis.leastTotalHours.title} (${analysis.leastTotalHours.totalTheoryHours + analysis.leastTotalHours.totalPracticeHours} horas)`)
}

analyzeCareerData().catch(console.error)
