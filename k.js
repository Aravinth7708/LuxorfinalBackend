import fetch from 'node-fetch';

const URL = "http://13.126.43.11:8000/api/villas";

async function getVillas() {
  try {
    const response = await fetch(URL);
    const data = await response.json();
    console.log("Fetched villas:", data);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

getVillas();
