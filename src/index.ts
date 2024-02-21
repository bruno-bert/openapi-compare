import axios, { AxiosRequestConfig } from 'axios';
import _ from 'lodash';

interface RouteSpecification {
    queryParameters: string[];
    responseBody: any;
    allowedHeaders: string[];
    authenticationMethods: string[];
}

async function fetchOpenApiSpec(repoUrl: string): Promise<any> {

    const config: AxiosRequestConfig = {
        auth: {
            username: process.env.GIT_USERNAME as unknown as string,
            password: process.env.GIT_PASSWORD as unknown as string
        }
    };

    const url = `${repoUrl}/raw/openapi.json?at=refs%2Fheads%2Fmain`
    console.log(url)
    const response = await axios.get(url, config);

    return response.data;
}

async function compareSpecifications(mainSpec: RouteSpecification, repoSpec: RouteSpecification): Promise<string[]> {
    const discrepancies: string[] = [];

    // Compare query parameters
    const queryParamsDiff = _.difference(mainSpec.queryParameters, repoSpec.queryParameters);
    if (queryParamsDiff.length > 0) {
        discrepancies.push(`Mismatch in query parameters: ${queryParamsDiff.join(', ')}`);
    }

    // Compare response body
    if (!_.isEqual(mainSpec.responseBody, repoSpec.responseBody)) {
        discrepancies.push('Mismatch in response body');
    }

    // Compare allowed headers
    const headersDiff = _.difference(mainSpec.allowedHeaders, repoSpec.allowedHeaders);
    if (headersDiff.length > 0) {
        discrepancies.push(`Mismatch in allowed headers: ${headersDiff.join(', ')}`);
    }

    // Compare authentication methods
    const authMethodsDiff = _.difference(mainSpec.authenticationMethods, repoSpec.authenticationMethods);
    if (authMethodsDiff.length > 0) {
        discrepancies.push(`Mismatch in authentication methods: ${authMethodsDiff.join(', ')}`);
    }

    return discrepancies;
}

async function analyzeRepository(repoUrl: string, mainSpec: any): Promise<{ [route: string]: string[] }> {
    const discrepanciesMap: { [route: string]: string[] } = {};

    const repoSpec = await fetchOpenApiSpec(repoUrl);

    for (const route in mainSpec.paths) {
        if (mainSpec.paths.hasOwnProperty(route)) {
            const mainRouteSpec = mainSpec.paths[route];
            const repoRouteSpec = repoSpec.paths[route];

            if (repoRouteSpec) {
                const discrepancies = await compareSpecifications(
                    {
                        queryParameters: mainRouteSpec.parameters?.map((param: any) => param.name) || [],
                        responseBody: mainRouteSpec.responses['200']?.content['application/json']?.schema || {},
                        allowedHeaders: mainRouteSpec.parameters?.filter((param: any) => param.in === 'header').map((param: any) => param.name) || [],
                        authenticationMethods: mainRouteSpec.security?.map((security: any) => Object.keys(security)) || []
                    },
                    {
                        queryParameters: repoRouteSpec.parameters?.map((param: any) => param.name) || [],
                        responseBody: repoRouteSpec.responses['200']?.content['application/json']?.schema || {},
                        allowedHeaders: repoRouteSpec.parameters?.filter((param: any) => param.in === 'header').map((param: any) => param.name) || [],
                        authenticationMethods: repoRouteSpec.security?.map((security: any) => Object.keys(security)) || []
                    }
                );

                if (discrepancies.length > 0) {
                    discrepanciesMap[route] = discrepancies;
                }
            } else {
                discrepanciesMap[route] = ['Route not found in repository'];
            }
        }
    }

    return discrepanciesMap;
}

async function main() {
    try {
        // Fetch main repository openapi.json
        const mainSpec = await fetchOpenApiSpec('https://github.com/bruno-bert/openapi-compare');

        // List of bitbucket repository URLs
        const bitbucketRepos = ['https://github.com/bruno-bert/openapi-compare1',
            'https://github.com/bruno-bert/openapi-compare2', /* Add more repo URLs as needed */];

        for (const repoUrl of bitbucketRepos) {
            const discrepancies = await analyzeRepository(repoUrl, mainSpec);
            console.log(`Discrepancies in ${repoUrl}:`, discrepancies);
        }
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main();
