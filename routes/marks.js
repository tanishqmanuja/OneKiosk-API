const express = require('express')
const cheerio = require('cheerio')
const superagent = require('superagent')
const urls = require('../assets/urls.json')
const tabletojson = require('tabletojson').Tabletojson
const router = express.Router();

let headers = {}
router.use((req,res,next)=>{
	headers = res.locals.wkheaders;
	next();
})

async function getList(){
    let page = await superagent.get(urls.marks)
        .set(headers)

    if(page.text.includes('Session Timeout Please')){
        return {
            status: 'timeout'
        }
    }
    let page$ = cheerio.load(page.text)
    let list = page$('[name=exam]').children().toArray().map(item => item.attribs.value).slice(1)

    return {
        list
    }
}

async function getMarks(semcode){
    let page = await superagent.get(urls.marks+urls.query+semcode)
    .set(headers)

    if(page.text.includes('Session Timeout Please')){
        return {
            status: 'timeout'
        }
    }

    let table = tabletojson.convert(page.text,{
        useFirstRowForHeadings: true
    })

    let cleanItem = obj => {
        delete obj['Sr.No.']
        for (var propName in obj) {
            if (obj[propName] === null || obj[propName] === undefined || obj[propName] === '') {
              delete obj[propName];
            }
        }

        let {'Subject(Code)': course, ...marks} = obj
        delete obj['Subject(Code)']
        course = {
            name: course.substring(0, course.lastIndexOf('-')).trim(),
            code: course.substring(course.lastIndexOf('-') + 1, course.length).trim()
        }

        return {course,marks}
    }

    let data = table[2].slice(1).map(cleanItem)

    return {data}
}

router.get('/list',async (req,res) => {
    let data = await getList()
    return res.status(200).json(data)
})

router.get('/:semcode',async (req,res) => {
    let semcode = req.params.semcode
    data = await getMarks(semcode)
    return res.status(200).json(data)
})

module.exports = router;