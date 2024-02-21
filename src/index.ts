import axios from 'axios';
import _ from 'lodash';

interface RouteSpecification {
    queryParameters: string[];
    responseBody: any;
    allowedHeaders: string[];
    authenticationMethods: string[];
}

async function fetchOpenApiSpec(repoUrl: string): Promise<any> {



    const url = `${repoUrl}/main/openapi.json`
    const response = await axios.get(url);
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

    const getResponseBody = (routeSpec: any) => {
        const responses = routeSpec.responses

        try {
            return responses['200']?.content['application/json']?.schema || {}
        } catch (error) {
            return responses['204']?.content['application/json']?.schema || {}
        }


    }

    const getSecurity = (routeSpec: any) => {

        const security = routeSpec.responses

        if (security) {
            return routeSpec.security?.map((security: any) => Object.keys(security)) || []
        }


    }


    const getAllowedHeaders = (routeSpec: any) => {
        const parameters = routeSpec.parameters
        let allowedHeaders = []
        if (parameters) {
            const headerParams = parameters.filter((param: any) => param.in === 'header')
            if (headerParams) {
                if (headerParams.length > 0) {
                    allowedHeaders = headerParams.map((param: any) => param.name) || []
                }
            }

        }

        return allowedHeaders
    }

    const getQueryParemeters = (routeSpec: any) => {
        let queryParams = []
        const parameters = routeSpec.parameters
        if (parameters) {
            queryParams = parameters.map((param: any) => param.name) || []
        }
        return queryParams

    }

    for (const route in mainSpec.paths) {
        if (mainSpec.paths.hasOwnProperty(route)) {
            const mainRouteSpec = mainSpec.paths[route];
            const repoRouteSpec = repoSpec.paths[route];

            const methods = ['get', 'post', 'put', 'delete']

            if (repoRouteSpec) {

                methods.map(async (method: any) => {
                    const mainRepoMethod = mainRouteSpec[method]
                    const compareRepoMethod = repoRouteSpec[method]

                    const discrepancies = await compareSpecifications(
                        {
                            queryParameters: getQueryParemeters(mainRepoMethod),
                            responseBody: getResponseBody(mainRepoMethod),
                            allowedHeaders: getAllowedHeaders(mainRepoMethod),
                            authenticationMethods: getSecurity(mainRepoMethod)
                        },
                        {
                            queryParameters: getQueryParemeters(compareRepoMethod),
                            responseBody: getResponseBody(compareRepoMethod),
                            allowedHeaders: getAllowedHeaders(compareRepoMethod),
                            authenticationMethods: getSecurity(compareRepoMethod)
                        }
                    );

                    if (discrepancies.length > 0) {
                        discrepanciesMap[route] = discrepancies;
                    }


                })

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
        const mainSpec = await fetchOpenApiSpec('https://raw.githubusercontent.com//bruno-bert/openapi-compare');

        // List of bitbucket repository URLs
        const bitbucketRepos = ['https://raw.githubusercontent.com//bruno-bert/openapi-compare-1',
            'https://raw.githubusercontent.com//bruno-bert/openapi-compare-2', /* Add more repo URLs as needed */];


        for (const repoUrl of bitbucketRepos) {
            const discrepancies = await analyzeRepository(repoUrl, mainSpec);


            console.log(`Discrepancies in ${repoUrl}:`, discrepancies);
        }
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main();
