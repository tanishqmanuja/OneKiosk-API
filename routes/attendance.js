const express = require('express')
const cheerio = require('cheerio')
const superagent = require('superagent')
const urls = require('../assets/urls.json')
const tabletojson = require('tabletojson').Tabletojson
const { last } = require('cheerio/lib/api/traversing')
const router = express.Router();

let headers = {}
router.use((req,res,next)=>{
	headers = res.locals.wkheaders;
	next();
})

async function getList(){
    let page = await superagent.get(urls.attendance)
        .set(headers)

    if(page.text.includes('Session Timeout Please')){
        return {
            status: 'timeout'
        }
    }
    let page$ = cheerio.load(page.text)
    let list = page$('[name=exam]').children().toArray().map(item => item.attribs.value)

    return {
        list
    }
}

async function getAttendance(semcode,detailed){

    let page
    if(semcode){
        page = await superagent.get(urls.attendance+urls.query+semcode)
            .set(headers)
    } else {
        page = await superagent.get(urls.attendance)
            .set(headers)
    }
    

    if(page.text.includes('Session Timeout Please')){
        return {
            status: 'timeout'
        }
    }

    let table = tabletojson.convert(page.text,{
        useFirstRowForHeadings: true
    })

    let cleanItem = obj => {
        delete obj['SNo']
        for (var propName in obj) {
            if (obj[propName] === null || obj[propName] === undefined || obj[propName] === '') {
              delete obj[propName];
            }
        }

        let {'Subject': course, ...attendance} = obj
        delete obj['Subject']

        course = {
            name: course.substring(0, course.lastIndexOf('-')).trim(),
            code: course.substring(course.lastIndexOf('-') + 1, course.length).trim()
        }

        attendance = {
            total: attendance["Lecture+Tutorial(%)"],
            lecture: attendance["Lecture(%)"],
            tutorial: attendance["Tutorial(%)"],
            practical: attendance["Practical(%)"]
        }

        return {course,attendance}
    }

    let data = table[2].slice(1).map(cleanItem)

    if(detailed){
        let dLinks = data.map(item => {
            let page$ = cheerio.load(page.text)
            let links = []
            let matcher = item.course.name + ' - ' + item.course.code
            links[0] = page$(`td:contains(${matcher})`)
                        .siblings('[align=center]').eq(0)
                        .children('a').eq(0)
                        .attr('href')
            links[1] = page$(`td:contains(${matcher})`)
                        .siblings('[align=center]').last()
                        .children('a[title="View Date wise Practical Attendance"]').eq(0)
                        .attr('href')
            return links
        })
    
        let dPages = await Promise.all(dLinks.map(links => {
            if(!links[0]) return Promise.all([null,null])
            if(links[0] && !links[1])
                return Promise.all([
                    superagent.get(urls.academic+links[0]).set(headers),
                    null
                ])
            else if(links[0] && links[1])
                return Promise.all([
                    superagent.get(urls.academic+links[0]).set(headers),
                    superagent.get(urls.academic+links[1]).set(headers)
                ])
        }))
    
        let details = dPages.map(pages => {
            let result = []

            let parseDetail = obj => {
                return {
                    date: obj['Date'],
                    teacher: obj['Attendance By'],
                    status: obj['Status'],
                    type: obj['Class Type'],
                    ltp: obj['LTP'] || 'Practical'
                }
            }

            pages.filter(Boolean).forEach(page => {
                let table = tabletojson.convert(page.text,{
                    useFirstRowForHeadings: true
                })
                result = result.concat(table[2].slice(1).map(parseDetail))
            })
            
            return result
        })
    
        for(let i = 0; i < data.length; i++) {
            /* reverse is used to put latest attendance first */
            data[i].details = details[i].reverse()
        }
    }


    return {data}
}

router.get('/list',async (req,res) => {
    let data = await getList()
    return res.status(200).json(data)
})

router.get('/:semcode',async (req,res)=>{
	let semcode = req.params.semcode
    data = await getAttendance(semcode)
    return res.status(200).json(data)
})

router.get('/detailed/:semcode',async (req,res)=>{
	let semcode = req.params.semcode
    data = await getAttendance(semcode,true)
    return res.status(200).json(data)
})


module.exports = router;