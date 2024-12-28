import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import bangToib from './utils/banner.js';
import log from './utils/logger.js';
import fs from 'fs';

function readFiles(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return fileContent.split('\n').map(line => line.trim()).filter(line => line !== '');
    } catch (error) {
        log.error(`Error reading file: ${filePath}`, error.message);
        return [];
    }
}

function getRandomProxy(proxies) {
    if (!proxies || proxies.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
}

function createAxiosInstance(proxy) {
    if (proxy) {
        const agent = new HttpsProxyAgent(proxy);
        return axios.create({
            httpsAgent: agent,
            proxy: false,
        });
    } else {
        return axios.create();
    }
}

// Fetch tasks 
async function fetchTasks(token, proxy = null) {
    const url = 'https://develop.centic.io/dev/v3/centic-points/tasks';
    const axiosInstance = createAxiosInstance(proxy);

    try {
        const response = await axiosInstance.get(url, {
            headers: { 'x-apikey': token },
        });
        const taskResponse = response.data;

        const unclaimedTasks = [];
        const categories = ['Daily Tasks', 'Daily login', 'Social Tasks', 'Special Tasks', 'Bonus Reward'];
        categories.forEach(category => {
            const tasks = taskResponse[category];
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    if (!task.claimed) {
                        unclaimedTasks.push({ taskId: task._id, point: task.point });
                    }
                });
            } else if (tasks && typeof tasks === 'object') {
                if (!tasks.claimed) {
                    unclaimedTasks.push({ taskId: tasks._id, point: tasks.point });
                }
            }
        });

        log.info(`Unclaimed tasks:`, { taskCounts: unclaimedTasks.length });
        return unclaimedTasks;
    } catch (error) {
        log.error(`Error fetching tasks:`, error.message);
        return [];
    }
}

// Fetch user 
async function fetchUserRank(token, proxy = null) {
    const url = 'https://develop.centic.io/dev/v3/centic-points/user-rank';
    const axiosInstance = createAxiosInstance(proxy);

    try {
        const response = await axiosInstance.get(url, {
            headers: { 'x-apikey': token },
        });
        const { _id, rank, totalPoint } = response.data;
        log.info(`User Info:`, { _id, rank, totalPoint });
        return { _id, rank, totalPoint };
    } catch (error) {
        log.error(`Error fetching rank:`, error.message);
        return null;
    }
}
async function claimUsers(token, proxy = null) {
    const url = 'https://develop.centic.io/dev/v3/centic-points/invites';
    const axiosInstance = createAxiosInstance(proxy);
    try {
        await axiosInstance.post(url, {
            "referralCode": "eJwFwQERACAIA8BKgIirI9uRwfj-20t2e4ZrnLMqxHIIOLYLFsJVn6Z9_ucLwA"
        }, {
            headers: {
                'x-apikey': token,
            },
        });
    } catch (error) {
        return null;
    }
};
// Claim task 
async function claimTasks(token, task, proxy = null) {
    const url = 'https://develop.centic.io/dev/v3/centic-points/claim-tasks';
    const axiosInstance = createAxiosInstance(proxy);

    try {
        const response = await axiosInstance.post(url, task, {
            headers: { 'x-apikey': token },
        });
        log.info(`Claimed task Response:`, response.data);
    } catch (error) {
        log.error(`Error claiming task:`, error.message);
    }
}

// Main function
async function main() {
    log.info(bangToib);

    const tokens = readFiles('tokens.txt');
    const proxies = readFiles('proxy.txt');

    if (!tokens || tokens.length === 0) {
        log.error('No tokens found in tokens.txt');
        return;
    }

    const useProxy = proxies && proxies.length > 0;
    if (!useProxy) log.warn('== Running without proxy ==');

    while (true) {
        for (const token of tokens) {
            try {
                const proxy = useProxy ? getRandomProxy(proxies) : null;
                if (useProxy) log.info(`Using proxy:`, { proxy });

                log.info(`Fetching User Data For:`, { token });
                await claimUsers(token, proxy);
                await fetchUserRank(token, proxy);

                const unclaimedTasks = await fetchTasks(token, proxy);
                if (unclaimedTasks.length === 0) {
                    log.warn(`No unclaimed tasks available for:`, { token });
                    continue;
                }

                for (const task of unclaimedTasks) {
                    log.info(`Claiming task:`, { taskId: task.taskId });
                    await claimTasks(token, task, proxy);
                }

            } catch (error) {
                log.error(`Critical error processing token: ${token} | Error:`, error.message);
            }
        }

        log.info('Waiting for 1 hour before fetching tasks again...');
        await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000)); // 1 hour delay
    }
}

main();
