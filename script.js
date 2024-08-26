(function () {
    'use strict';

    const controls = {}
    const elements = {}
    let repoData = []

    function formatNum(number, orDefault) {
        return !number ? orDefault : Number(number).toLocaleString();
    }

    function getRepo(name) {
        let repo;
        repoData.forEach(r => {
            if (r.name === name) {
                repo = r;
            }
        });
        return repo;
    }

    function init() {
        const query = {};
        const queryString = window.location.search;
        const pairs = (queryString[0] === '?' ? queryString.substring(1) : queryString).split('&');
        for (let i = 0; i < pairs.length; i++) {
            let pair = pairs[i].split('=');
            query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }

        controls.usernameInput = document.getElementById('username');
        controls.submitButton = document.getElementById('submit');
        elements.withoutReleases = document.getElementById('withoutReleases');

        const groupColumn = 0;
        controls.resultsTable = new DataTable("#results", {
            columns: [{
                title: 'Repository', type: 'html', visible: false
            }, {
                title: 'Total Repo DLs', type: 'num', visible: false, className: 'total-downloads'
            }, {
                title: 'Release', type: 'html'
            }, {
                title: 'Author', type: 'html'
            }, {
                title: 'Published', type: 'html'
            }, {
                title: 'Downloads',
                type: "num",
                render: {
                    _: 'display',
                    sort: 'num'
                },
            }, {
                title: 'File(s)', type: 'html'
            }],
            autoWidth: true,
            order: [[1, 'desc'], [groupColumn, 'asc'], [4, 'desc']],
            responsive: true,
            paging: false,
            displayLength: -1,
            drawCallback: function (settings) {
                var api = this.api();
                var rows = api.rows({page: 'current'}).nodes()
                var last = null;

                api.column(groupColumn, {page: 'current'})
                    .data()
                    .each(function (group, i) {
                        if (last !== group) {
                            const repo = getRepo(group);
                            $(rows).eq(i).before(
                                `<tr class="group">
                                            <td colspan="3"><a target="_blank" href="${repo?.html_url}"><i class="bi bi-box-arrow-up-right"></i> ${group}</a></td>
                                            <td class="dt-type-numeric">${formatNum(getRepo(group)?.totalDownloads, '---')}</td>
                                            <td></td>
                                        </tr>`);
                            last = group;
                        }
                    })
            }
        });
        $(document).on('click', '#results tr.group', function () {
            controls.resultsTable.order([[1, 'desc'], [groupColumn, 'asc'], [4, 'desc']]).draw();
        });

        function getRepoStats() {
            controls.submitButton.setAttribute("disabled", "disabled");
            elements.withoutReleases.innerHTML = ""
            controls.resultsTable.clear();
            repoData = []

            const user = $("#username").val();
            const apiRoot = "https://api.github.com";
            const reposUrl = `${apiRoot}/users/${user}/repos`;

            const settings = {}
            if (query.token) {
                settings.headers = {'Authorization': 'Bearer ' + query.token}
            }
            fetch(reposUrl, settings).then(res => res.json()).then(repos => {
                const promises = []
                repos.forEach(repo => {
                    const repoName = repo.name;
                    const releasesUrl = `${apiRoot}/repos/${user}/${repoName}/releases`;

                    promises.push(fetch(releasesUrl, settings).then(res => res.json()).then(releases => {
                        repo.releases = releases;

                        let totalDownloads = 0;
                        (releases || []).forEach(release => {
                            release.downloads = 0;

                            release.assets.forEach(asset => release.downloads += asset.download_count);

                            totalDownloads += release.downloads;
                        })

                        repo.totalDownloads = totalDownloads;

                        repoData.push(repo);
                    }));
                });

                Promise.all(promises).then(() => {
                    controls.submitButton.removeAttribute("disabled")

                    console.log("Done")
                    console.log(repoData)

                    const withoutHtml = []
                    repoData.forEach(repo => {
                        if (repo.totalDownloads) {
                            repo.releases.forEach(release => {
                                const releaseTag = release.tag_name;
                                const releaseAuthor = release.author;
                                const publishDate = release.published_at.split("T")[0];
                                const assetsHtml = []
                                release.assets.forEach(asset => {
                                    assetsHtml.push(`<li><code>${asset.name}</code> (${(asset.size / 1048576.0).toFixed(2)}MiB)</li>`)
                                })

                                const rows = [
                                    [
                                        repo.name,
                                        repo.totalDownloads,
                                        `<a target="_blank" href="${release.html_url}">${releaseTag}</a>`,
                                        `<a target="_blank" href="https://github.com/${releaseAuthor.login}">@${releaseAuthor.login}</a>`,
                                        publishDate,
                                        {
                                            display: formatNum(release.downloads, ""),
                                            num: release.downloads || -1
                                        },
                                        `<ul style="margin:0">${assetsHtml.join('')}</ul>`
                                    ]
                                ]
                                controls.resultsTable.rows.add(rows).draw(false);
                                controls.resultsTable.columns.adjust().draw(false);
                            })
                        } else {
                            withoutHtml.push(`<li><a target="_blank" href="${repo.html_url}"><i class="bi bi-box-arrow-up-right"></i> ${repo.name}</a></li>`);
                        }
                    })
                    withoutHtml.sort();
                    elements.withoutReleases.innerHTML = withoutHtml.join('');
                })
            })
        }
        controls.submitButton.onclick = getRepoStats;

        if (query.username) {
            controls.usernameInput.value = query.username;
            controls.submitButton.click();
        }
    }

    window.onload = init;
}())