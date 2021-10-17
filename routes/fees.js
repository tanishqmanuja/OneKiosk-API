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

async function getFees(){
    let page = await superagent.get(urls.fees)
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
            'Subject': subject,
            'Fee Currency': currency,
            'Fee Amount': amount,
            'Discount': discount,
            'Net Paid': paid,
            'Dues (if any)': dues
        } = obj
        return {semester,subject,currency,amount,discount,paid,dues}
    }

    let data = table[2].slice(1,-2).map(cleanItem)

    return {data}
}


router.get('/',async (req,res) => {
    data = await getFees()
    return res.status(200).json(data)
})

module.exports = router;