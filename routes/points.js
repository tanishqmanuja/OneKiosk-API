const express = require('express')
const superagent = require('superagent')
const urls = require('../assets/urls.json')
const tabletojson = require('tabletojson').Tabletojson
const router = express.Router();

let headers = {}
router.use((req,res,next)=>{
	headers = res.locals.wkheaders;
	next();
})

async function getPoints(){
    let page = await superagent.get(urls.points)
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

        let {
            'Semester': semester,
            'Course Credit': credits,
            'SGPA': sgpa,
            'CGPA': cgpa,
        } = obj
        return {semester,credits,sgpa,cgpa}
    }

    let data = table[2].slice(1).map(cleanItem)

    return {data}
}


router.get('/',async (req,res) => {
    data = await getPoints()
    return res.status(200).json(data)
})

module.exports = router;