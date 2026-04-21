const dataset = [
  {
    type: "ranking",
    prompt: "Explain REST API",
    responses: [
      "REST API is an interface.",
      "REST API allows communication between systems using HTTP methods."
    ],
    correct: 1
  },
  {
    type: "ranking",
    prompt: "Explain caching",
    responses: [
      "Caching stores data.",
      "Caching stores frequently accessed data to reduce latency and backend load."
    ],
    correct: 1
  },
  {
    type: "debug",
    trace: [
      "Login success",
      "Fetch profile → 401",
      "Retry → 401"
    ],
    correct: "token"
  },
  {
    type: "debug",
    trace: [
      "Payment success",
      "Order not updated"
    ],
    correct: "callback"
  },
  {
    type: "debug",
    trace: [
      "SQL error: column not found"
    ],
    correct: "syntax"
  }
];
