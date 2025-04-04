# TeaSend

TeaSend is an automated bot that sends TEA transactions to random blockchain addresses. The bot can be used to send transactions on a scheduled basis with a configurable daily transaction limit.

## Features

- Sends TEA to random addresses or from a predefined list.
- Checks gas fees for blockchain transactions.
- Limits the number of transactions sent per day.

## Prerequisites

Before running TeaSend, ensure you have the following:

- Node.js and npm (Node Package Manager) installed on your machine.
- A `.env` file containing configuration such as RPC URL and private key for wallet access.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/ZackyMrf/TeaSend.git
2. Navigate to the project directory
    ```bash
    cd TeaSend
3. Install dependencies
     ```bash
     npm install
4. Copy the .env.example file to .env:
   ```bash
   cp .env.example .env
5. Edit the .env file to add your  PRIVATE_KEYS.

6. run 
    ```bash
    npm start



