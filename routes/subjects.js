const express = require("express");
const cheerio = require("cheerio");
const superagent = require("superagent");
const urls = require("../assets/urls.json");
const tabletojson = require("tabletojson").Tabletojson;
const router = express.Router();

let headers = {};
router.use((req, res, next) => {
	headers = res.locals.wkheaders;
	next();
});

async function getList() {
	let page = await superagent.get(urls.subjects).set(headers);

	if (page.text.includes("Session Timeout Please")) {
		return {
			status: "timeout",
		};
	}
	let page$ = cheerio.load(page.text);
	let list = page$("[name=exam]")
		.children()
		.toArray()
		.map(item => item.attribs.value)
		.slice(1)
		.reverse();

	return {
		list,
	};
}

async function getSubjects(semcode) {
	let page = await superagent
		.get(urls.subjects + urls.query + semcode)
		.set(headers);

	if (page.text.includes("Session Timeout Please")) {
		return {
			status: "timeout",
		};
	}

	let table = tabletojson.convert(page.text, {
		useFirstRowForHeadings: true,
	});

	let cleanItem = obj => {
		for (var propName in obj) {
			if (
				obj[propName] === null ||
				obj[propName] === undefined ||
				obj[propName] === ""
			) {
				delete obj[propName];
			}
		}

		obj.name = obj["Subject"].substring(0, obj["Subject"].lastIndexOf("("));
		obj.code = obj["Subject"].substring(
			obj["Subject"].lastIndexOf("(") + 1,
			obj["Subject"].length - 1
		);

		let {
			name: name,
			code: code,
			Credit: credits,
			"Core/Elective": type,
		} = obj;
		return { name, code, credits, type };
	};

	let data = table[2].slice(1, -1).map(cleanItem);

	return { data };
}

async function getFaculties(semcode) {
	let page = await superagent
		.get(urls.faculty + urls.query + semcode)
		.set(headers);

	if (page.text.includes("Session Timeout Please")) {
		return {
			status: "timeout",
		};
	}

	let table = tabletojson.convert(page.text, {
		useFirstRowForHeadings: true,
	});

	let cleanItem = obj => {
		for (var propName in obj) {
			if (
				obj[propName] === null ||
				obj[propName] === undefined ||
				obj[propName] === ""
			) {
				delete obj[propName];
			}
		}
		if (!obj["Subject"]) return;

		obj.name = obj["Subject"].substring(0, obj["Subject"].lastIndexOf("("));
		obj.code = obj["Subject"].substring(
			obj["Subject"].lastIndexOf("(") + 1,
			obj["Subject"].length - 1
		);

		obj.faculty = {};

		if (obj["Faculty(Lecture)"]) obj.faculty.lecture = obj["Faculty(Lecture)"];
		if (obj["Faculty(Tutorial)"])
			obj.faculty.tutorial = obj["Faculty(Tutorial)"];
		if (obj["Faculty(Practical)"])
			obj.faculty.practical = obj["Faculty(Practical)"];

		let { name: name, code: code, faculty: faculty } = obj;
		return { name, code, faculty };
	};

	let data = table[2].slice(1).map(cleanItem);

	return { data };
}

router.get("/list", async (req, res) => {
	let data = await getList();
	return res.status(200).json(data);
});

router.get("/:semcode", async (req, res) => {
	let semcode = req.params.semcode;
	let subjects = (await getSubjects(semcode)).data;
	let faculties = (await getFaculties(semcode)).data;

	let data = subjects.map(subject => {
		if (!faculties.length > 0) return subject;

		let found = faculties.filter(faculty => faculty.code === subject.code);

		let faculty = {};
		if (found && found.length) {
			faculty = found[0].faculty;
		}
		return { ...subject, faculty };
	});
	return res.status(200).json({ data });
});

module.exports = router;
