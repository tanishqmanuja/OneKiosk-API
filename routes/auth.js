const express = require("express");
const superagent = require("superagent");
const urls = require("../assets/urls.json");
const cheerio = require("cheerio");
const router = express.Router();

let headers = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36",
	"Content-Type": "application/x-www-form-urlencoded",
};

async function login(credentials) {
	let webkiosk = await superagent.get(urls.base);
	let webkiosk$ = cheerio.load(webkiosk.text);
	let captcha = webkiosk$('font[face="casteller"]').html();
	headers.Cookie = webkiosk.headers["set-cookie"];

	let form = {
		reqfrom: "jsp",
		x: "",
		txtInst: "Institute",
		InstCode: "JIIT",
		txtuType: "Member Type",
		UserType101117: "S",
		txtCode: "Enrollment No",
		MemberCode: credentials.enroll,
		DOB: "DOB",
		DATE1: credentials.dob,
		txtPin: "Password/Pin",
		Password101117: credentials.pass,
		txtCode: "Enter Captcha     ",
		txtcap: captcha,
		BTNSubmit: "Submit",
	};

	let login = await superagent
		.post(urls.login)
		.set(headers)
		.type("form")
		.send(form);

	const isAuthenticated = login.text.includes("FrameLeftStudent");
	let reason = "";

	if (!isAuthenticated) {
		if (login.text.includes("Invalid Password")) reason = "invalid pass";
		else if (login.text.includes("invalid Password or Date or Birth"))
			reason = "invalid dob or pass";
		else reason = "unknown";
	}

	return { isAuthenticated, reason };
}

async function logout() {
	let logout = await superagent.get(urls.logout).set(headers);

	return logout.text.includes("Session Timeout");
}

function authHeaderGaurd(req, res, next) {
	const authHeader = req.headers.authorization;
	if (authHeader) {
		const creds64 = authHeader.slice(6);
		const creds = JSON.parse(Buffer.from(creds64, "base64").toString());
		// console.log(credentials);
		res.locals.credentials = creds;
		next();
		return;
	}
	// console.log("no authorization header");
	return res.status(200).json({
		isAuthenticated: false,
		reason: "no auth found",
	});
}

async function loginGaurd(req, res, next) {
	const credentials = res.locals.credentials;
	const { isAuthenticated, reason } = await login(credentials);

	if (isAuthenticated) {
		res.locals.wkheaders = headers;
		next();
	} else {
		return res.status(200).json({
			isAuthenticated,
			reason,
		});
	}
}

router.get("/login", async (req, res) => {
	const credentials = res.locals.credentials;
	const { isAuthenticated, reason } = await login(credentials);
	return res.status(200).json({
		isAuthenticated,
		reason,
	});
});

router.get("/logout", async (req, res) => {
	await logout();
	return res.status(200).json({
		isAuthenticated: false,
	});
});

module.exports = {
	authRouter: router,
	authHeaderGaurd,
	loginGaurd,
};
