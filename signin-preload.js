// Runs before Google's sign-in page scripts, in the page itself.
// Makes the sign-in window look like Firefox so Google allows the sign-in.
(function () {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
  const def = (obj, key, val) => { try { Object.defineProperty(obj, key, { get: () => val, configurable: true }); } catch (e) {} };
  def(Navigator.prototype, 'userAgent', UA);
  def(Navigator.prototype, 'appVersion', '5.0 (Windows)');
  def(Navigator.prototype, 'vendor', '');
  def(Navigator.prototype, 'userAgentData', undefined);
  def(Navigator.prototype, 'webdriver', false);
  def(Navigator.prototype, 'oscpu', 'Windows NT 10.0; Win64; x64');
  def(Navigator.prototype, 'buildID', '20181001000000');
  def(Navigator.prototype, 'productSub', '20100101');
  try { delete window.chrome; } catch (e) {}
  try { delete window.process; delete window.require; delete window.module; } catch (e) {}
})();
