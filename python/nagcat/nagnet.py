# Copyright 2009 ITA Software, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Nagios XMLRPC Server"""

import sys
from optparse import OptionParser
from twisted.internet import reactor

from nagcat import errors, log, monitor_api, nagios_api, util

def parse_options():
    """Parse program options in sys.argv"""

    parser = OptionParser()

    parser.add_option("-c", "--config", dest="config",
            help="coil config file with test templates")
    parser.add_option("-v", "--loglevel", dest="loglevel",
            default="INFO", help="one of: ERROR WARN INFO DEBUG")
    parser.add_option("-l", "--logfile", dest="logfile",
            help="log file, automatically rotated")
    parser.add_option("-p", "--pidfile", dest="pidfile",
            help="pid file")
    parser.add_option("-d", "--daemon", dest="daemon",
            action="store_true", default=False,
            help="run as a daemon")
    parser.add_option("-n", "--nagios", dest="nagios",
            help="path to nagios.cfg (required)")
    parser.add_option("-P", "--port", dest="port", type="int",
            help="port to listen on (required)")
    parser.add_option("-H", "--host", dest="host", default="",
            help="local host name or address to listen on")
    parser.add_option("-R", "--read-only", action="store_true",
            help="provide information but don't accept commands")

    (options, args) = parser.parse_args()

    err = []
    if not options.nagios:
        err.append("--nagios is required")

    if not options.port:
        err.append("--port is required")

    if options.daemon and (not options.pidfile or not options.logfile):
        err.append("--logfile and --pidfile are required with --daemon")

    if options.loglevel not in log.LEVELS:
        err.append("invalid log level '%s'" % options.loglevel)
        err.append("must be one of: %s" % " ".join(log.LEVELS))

    if err:
        parser.error("\n".join(err))

    return options


def main():
    """Start up NagCat, profiling things as requested"""

    options = parse_options()
    log.init(options.logfile, options.loglevel)

    if options.pidfile:
        util.write_pid(options.pidfile)

    site = monitor_api.MonitorSite()
    site.root.putChild("nagios", nagios_api.NagiosStatus(options.nagios))

    if not options.read_only:
        try:
            rpc = nagios_api.NagiosXMLRPC(options.nagios)
        except errors.InitError, ex:
            log.error(str(ex))
            sys.exit(1)
        site.root.putChild("RPC2", rpc)

    reactor.listenTCP(options.port, site, interface=options.host)

    if options.daemon:
        util.daemonize(options.pidfile)

    log.init_stdio()
    reactor.run()
