const express = require("express");
const cheerio = require("cheerio");
const superagent = require("superagent");
const urls = require("./assets/urls.json");

require("dotenv").config();

const cors = require("cors")({
	origin: true,
});

const app = express();
app.use(cors);

// Fix for caching problem
app.disable("etag");

if (process.env.NODE_ENV !== "production") {
	const morgan = require("morgan");
	app.use(morgan("tiny"));
}

app.get("/", (req, res) => {
	res.status(200).send("Welcome to OneKiosk API");
	return;
});

// Authentication

const { authRouter, authHeaderGaurd, loginGaurd } = require("./routes/auth");

if (process.env.AUTH_FROM_ENV === "true") {
	console.log("Using credentials from ENV");
	app.use((req, res, next) => {
		const credentials = {
			enroll: process.env.ENROLLMENT,
			pass: process.env.PASSWORD,
			dob: process.env.DOB,
		};
		res.locals.credentials = credentials;
		next();
	});
} else {
	app.use(authHeaderGaurd);
}

app.use(authRouter);
app.use(loginGaurd);

// ROUTEs
const routes = ["marks", "attendance", "fees", "points", "subjects", "grades"];
routes.forEach(route => {
	const r = require(`./routes/${route}`);
	app.use(`/${route}`, r);
});

let port = process.env.OPTIC_API_PORT || process.env.PORT || 3000;
app.listen(port, () => {
	console.log(
		`OneKiosk APIs active at ${
			process.env.PORT ? "" : "http://localhost:"
		}${port}`
	);
});
