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
    let page = await superagent.get(urls.grades)
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

async function getGrades(semcode){
    let page = await superagent.get(urls.grades+urls.query+semcode)
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
        for (var propName in obj) {
            if (obj[propName] === null || obj[propName] === undefined || obj[propName] === '') {
              delete obj[propName];
            }
        }

        obj.name = obj['Subject'].substring(0,obj['Subject'].lastIndexOf('('))
        obj.code = obj['Subject'].substring(obj['Subject'].lastIndexOf('(')+1,obj['Subject'].length-1)

        let {
            'name': name,
            'code': code,
            'Grade Awarded': grade,
        } = obj
        return {name,code,grade}
    }

    let data = table[2].slice(1).map(cleanItem)

    return {data}
}

async function getGradesAll(){
    let { list } = await getList()
    let grades = await Promise.all(list.map(semcode => {
        if(!semcode) return
        return getGrades(semcode)
    }))

    grades = grades.map((grade,i) => {
        return {
            semcode: list[i],
            grades: grade.data
        }
    })

    return {data:grades}
}

router.get('/list',async (req,res) => {
    let data = await getList()
    return res.status(200).json(data)
})

router.get('/all',async (req,res) => {
    data = await getGradesAll()
    return res.status(200).json(data)
})

router.get('/:semcode',async (req,res) => {
    let semcode = req.params.semcode
    data = await getGrades(semcode)
    return res.status(200).json(data)
})

module.exports = router;